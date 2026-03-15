-- Ensure profiles table exists with necessary columns
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  phone text,
  avatar_url text,
  plan_tier text default 'free',
  analysis_count int default 0,
  analysis_limit int default 3,
  current_session_id text,
  premium_expires_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies
create policy "Users can view their own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- Enable Realtime for profiles
alter publication supabase_realtime add table profiles;
