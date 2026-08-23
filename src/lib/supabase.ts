import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly in the console rather than silently hitting undefined
  // endpoints — but do NOT let this crash the module. supabase-js's
  // createClient() throws synchronously ("supabaseUrl is required.") when
  // the URL is falsy, and since this module is imported by several routed
  // pages, an uncaught throw here at import time takes down the whole page
  // that imported it with nothing rendered. A placeholder URL keeps the
  // client constructible so the rest of the app still renders; real
  // Supabase calls will simply fail (and log) until the env vars are set
  // for this deployment.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY for this build. ' +
      'Set them in your deployment environment (e.g. Cloudflare build settings / wrangler vars) — ' +
      'Vite inlines VITE_ vars at build time, so they must be present when `npm run build` runs, not just at runtime. ' +
      'Copy .env.example to .env.local for local dev.'
  )
}

export const supabase = createClient<Database>(url || 'https://placeholder.invalid', anonKey || 'placeholder-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true }
})