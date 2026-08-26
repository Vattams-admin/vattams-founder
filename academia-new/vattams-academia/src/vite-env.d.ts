/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_UPI_PAYEE_NAME: string
  readonly VITE_UPI_VPA: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
