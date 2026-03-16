import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// Debug (Temporary)
console.log("[SUPABASE] Init:", {
  url: supabaseUrl ? 'OK (' + supabaseUrl.substring(0, 10) + '...)' : 'MISSING',
  key: supabaseAnonKey ? 'OK (' + supabaseAnonKey.substring(0, 10) + '...)' : 'MISSING'
})

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)
