import { supabase } from '@/lib/supabase'

// Phase 2: mirrors a NEW Firebase registration into the corresponding
// Supabase table, keyed by firebase_uid. This is intentionally
// best-effort and never blocks or rolls back the Firebase side — Firebase
// remains the source of truth for student/tutor auth (unchanged from
// Phase 1). If this insert fails (missing table, RLS denial, wrong
// column name), the person still has a working Firebase account and can
// use the site; only their row in the new admin-facing table is missing
// until this is retried or the mismatch is fixed.
//
// Uses upsert on firebase_uid (not insert) so a retry — e.g. the network
// call succeeded server-side but the client didn't get the response, and
// some retry logic calls this again later — updates the existing row
// instead of creating a duplicate, satisfying "do not create duplicate
// rows." This requires a unique constraint/index on firebase_uid in each
// table; if none exists, upsert falls back to plain insert behaviour and
// duplicates become possible — REQUIRES SUPABASE VERIFICATION.

export interface AcademyStudentRegistrationInput {
  firebaseUid: string
  fullName: string
  email: string
}

export interface AcademyTutorRegistrationInput {
  firebaseUid: string
  fullName: string
  email: string
  qualification: string
  expertise: string
}

export async function syncAcademyStudent(input: AcademyStudentRegistrationInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('academy_students')
    .upsert(
      {
        firebase_uid: input.firebaseUid,
        full_name: input.fullName,
        email: input.email,
        status: 'active',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'firebase_uid' }
    )

  if (error && import.meta.env.DEV) {
    console.error('[academyRegistration] Failed to sync academy_students row:', error)
  }

  return { error: error ? error.message : null }
}

export async function syncAcademyTutor(input: AcademyTutorRegistrationInput): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('academy_tutors')
    .upsert(
      {
        firebase_uid: input.firebaseUid,
        full_name: input.fullName,
        email: input.email,
        qualification: input.qualification,
        // "expertise" (Firestore field name) maps to the "subjects" field
        // requested in the Phase 2 spec — stored as free text here since
        // the actual column type (text vs text[]) could not be confirmed.
        subjects: input.expertise,
        // The registration form does not collect phone, city, teaching
        // mode, or availability, so those columns are intentionally left
        // unset rather than filled with a guess or an unrelated field
        // (e.g. the form's free-text "introduction" is NOT the same
        // thing as "availability" — mapping it there would just be
        // wrong data). Add fields to the form first if these need to be
        // captured at registration time.
        status: 'pending_approval',
        approval_status: 'pending',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'firebase_uid' }
    )

  if (error && import.meta.env.DEV) {
    console.error('[academyRegistration] Failed to sync academy_tutors row:', error)
  }

  return { error: error ? error.message : null }
}
