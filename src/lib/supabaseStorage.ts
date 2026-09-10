import { firebaseAuth } from '@/lib/firebase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/course-material`

const DEFAULT_BUCKET =
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'academia-course-materials'

export interface SupabaseUploadResult {
  url: string
  storagePath: string
  size: number
  mimeType: string
}

interface FunctionResponse {
  ok?: boolean
  url?: string
  path?: string
  token?: string
  expires_in?: number
  error?: string
  // Present on structured failures (see supabase/functions/course-material) —
  // a sanitized technical detail, safe to log but not to show to students.
  message?: string
  details?: string
}

async function getFirebaseToken(): Promise<string> {