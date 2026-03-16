import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// No logs in production for security hygiene

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Fallback only to avoid total crash, but actual URL should be in Vercel

export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || '', 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true, // Switched to true as useSession usually needs this
      detectSessionInUrl: true
    }
  }
)
