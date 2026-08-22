import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly in dev rather than silently hitting undefined endpoints.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill these in.'
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})
