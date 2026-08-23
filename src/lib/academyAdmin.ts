import { supabase } from '@/lib/supabase'
import type { AcademyStudent, AcademyTutor } from '@/types/academy'

// ---------------------------------------------------------------------
// Reads always use select('*') rather than a named column list. The real
// schema of academy_students / academy_tutors could not be confirmed from
// this repo (see src/types/academy.ts), so selecting '*' guarantees the
// list pages still load and render *something* even if some of the
// display-field name guesses below are wrong — instead of the whole page
// failing on "column does not exist".
// ---------------------------------------------------------------------

export interface AcademyListResult<T> {
  rows: T[]
  error: string | null
}

function friendlySupabaseError(error: { message: string; code?: string } | null, context: string): string | null {
  if (!error) return null

  // Surface the real error in dev so the exact column/table mismatch is
  // visible; show a clean message in production.
  if (import.meta.env.DEV) {
    console.error(`[academyAdmin] ${context}:`, error)
  }

  // PostgREST: table truly missing (schema cache / doesn't exist yet).
  if (error.message?.toLowerCase().includes('could not find the table')) {
    return `The ${context} table could not be found. It may not have been created yet, or the Supabase schema cache needs a reload.`
  }

  // PostgREST/Postgres: RLS denial usually surfaces as a permission error
  // or as an empty result with a 42501 code.
  if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied')) {
    return `You don't have permission to view ${context}. Check that your admin account has an active Supabase session and a matching RLS policy.`
  }

  if (error.message?.toLowerCase().includes('failed to fetch')) {
    return `Network error while loading ${context}. Check your connection and try again.`
  }

  return `Something went wrong loading ${context}. Please try again.`
}

export async function listAcademyStudents(): Promise<AcademyListResult<AcademyStudent>> {
  const { data, error } = await supabase
    .from('academy_students')
    .select('*')
    .order('created_at', { ascending: false })

  return {
    rows: (data as unknown as AcademyStudent[]) ?? [],
    error: friendlySupabaseError(error, 'students'),
  }
}

export async function listAcademyTutors(): Promise<AcademyListResult<AcademyTutor>> {
  const { data, error } = await supabase
    .from('academy_tutors')
    .select('*')
    .order('created_at', { ascending: false })

  return {
    rows: (data as unknown as AcademyTutor[]) ?? [],
    error: friendlySupabaseError(error, 'tutors'),
  }
}

/**
 * Approves a pending tutor. `adminIdentifier` should be something stable
 * and human-identifiable for the `approved_by` audit field — this project
 * has no single canonical "current admin id" shared between Firebase and
 * Supabase (see docs on the dual-auth admin flow), so callers pass the
 * admin's email, which both sides log in with.
 */
export async function approveAcademyTutor(tutorId: string, adminIdentifier: string) {
  const { error } = await supabase
    .from('academy_tutors')
    .update({
      approval_status: 'approved',
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminIdentifier,
    })
    .eq('id', tutorId)

  return { error: friendlySupabaseError(error, 'tutor approval') }
}

export async function rejectAcademyTutor(tutorId: string, adminIdentifier: string, reason: string) {
  const { error } = await supabase
    .from('academy_tutors')
    .update({
      approval_status: 'rejected',
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: adminIdentifier,
      rejection_reason: reason,
    })
    .eq('id', tutorId)

  return { error: friendlySupabaseError(error, 'tutor rejection') }
}

// ---------------------------------------------------------------------
// Display-field normalization: several fields in the spec (subjects,
// experience) could plausibly be stored under a slightly different name
// or shape than guessed in academy.ts. These helpers try the most likely
// alternates before giving up, so the UI degrades gracefully instead of
// showing "—" for a field that does exist under a different key.
// ---------------------------------------------------------------------

export function displaySubjects(tutor: AcademyTutor): string {
  const raw = tutor.subjects ?? (tutor as unknown as Record<string, unknown>).subject
  if (!raw) return '—'
  if (Array.isArray(raw)) return raw.join(', ')
  return String(raw)
}

export function displayField(row: Record<string, unknown>, ...candidateKeys: string[]): string {
  for (const key of candidateKeys) {
    const value = row[key]
    if (value !== null && value !== undefined && value !== '') {
      return String(value)
    }
  }
  return '—'
}
