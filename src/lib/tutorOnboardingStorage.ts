// src/lib/tutorOnboardingStorage.ts
//
// Mirrors src/lib/supabaseStorage.ts exactly (same Edge-Function-issues-
// a-signed-URL pattern, same Firebase-ID-token auth), pointed at a
// separate private bucket + Edge Function for tutor onboarding
// documents instead of course materials. Kept as its own module rather
// than parameterizing supabaseStorage.ts because the two buckets have
// different authorization rules (course materials: admin or enrolled
// student; onboarding documents: admin or the owning tutor only) and
// the task spec asks for tutor documents to be independently reviewable
// without touching the course-material path.

import { firebaseAuth } from '@/lib/firebase'
import type { TutorOnboardingDocumentType } from '@/types/tutorOnboarding'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

if (!SUPABASE_URL) {
  throw new Error(
    'VITE_SUPABASE_URL is missing. Add it to the environment, then restart Vite.'
  )
}

const SUPABASE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/tutor-onboarding-document`
const BUCKET = 'academia-tutor-onboarding-docs'

interface FunctionResponse {
  ok?: boolean
  url?: string
  path?: string