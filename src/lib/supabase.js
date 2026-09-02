// Supabase client — single instance shared across the app.
// Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anon)

if (!isSupabaseConfigured) {
  // Surfaced in the browser console so a misconfigured .env is obvious in dev.
  console.warn(
    '[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — ' +
      'auth and cloud storage are disabled. Copy .env.example to .env and fill them in.'
  )
}

// Fallbacks keep createClient from throwing when env is absent; calls will fail
// gracefully (and isSupabaseConfigured lets the UI warn the user).
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
)
