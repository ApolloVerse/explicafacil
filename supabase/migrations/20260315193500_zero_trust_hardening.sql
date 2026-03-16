-- Hardened Security & IA Cost Protection Migration
-- Phase: EXECUTION (Problem X, Y, Z)

-- 1. SCHEMA HARDENING
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_analysis_at TIMESTAMP WITH TIME ZONE;

-- Ensure messages table has user ownership
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. AUDIT LOGGING (Problem Y)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
-- Only service_role or admins should read logs
CREATE POLICY "Admins only access to audit logs" ON security_audit_logs FOR SELECT USING (false);

-- Trigger Function for Auditing
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_logs (user_id, action, table_name, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Audit to Profiles and Payments
DROP TRIGGER IF EXISTS tr_audit_profiles ON profiles;
CREATE TRIGGER tr_audit_profiles
AFTER UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

DROP TRIGGER IF EXISTS tr_audit_payments ON payments;
CREATE TRIGGER tr_audit_payments
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

-- 3. ATOMIC CREDIT MANAGEMENT (Problem X)
CREATE OR REPLACE FUNCTION decrement_credits(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET 
    analysis_count = analysis_count + 1,
    credits = credits - 1,
    updated_at = now()
  WHERE id = target_user_id
    AND plan_tier = 'free'
    AND credits > 0;
    
  -- If user is premium, we still increment count but don't touch credits
  UPDATE profiles
  SET 
    analysis_count = analysis_count + 1,
    updated_at = now()
  WHERE id = target_user_id
    AND plan_tier = 'premium';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. STRICT RLS POLICIES (Problem Y)
-- Cleanup existing policies to avoid duplicates
DROP POLICY IF EXISTS "Users can only see their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only see their own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can only see their own messages" ON messages;
DROP POLICY IF EXISTS "Users can only insert their own messages" ON messages;

CREATE POLICY "Profiles strict isolation" ON profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Analyses strict isolation" ON analyses 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Messages strict isolation" ON messages 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Messages insert isolation" ON messages 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
