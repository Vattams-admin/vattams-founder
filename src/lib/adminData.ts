import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

// Admin identity now lives in Firebase Auth + this Firestore `admins`
// collection, mirroring the existing `students` / `tutors` collections
// (doc id = Firebase uid). This does not replace or touch the Supabase
// `public.admins` table — that table still exists and still gates every
// RLS-protected admin action (approving payments, publishing courses)
// via `auth.uid()`. The two `admins` records for a given person must
// share the same role of "this person is an admin" but are provisioned
// separately: one row per system, keyed by that system's own user id.
//
// See docs/PHASE-MASTER-MATRIX.md-style note: an admin needs BOTH
//   1. a Firebase Auth user + a Firestore `admins/{firebaseUid}` doc, and
//   2. a Supabase Auth user (same email) with a matching row in the
//      Supabase `public.admins` table (id = that Supabase user's id)
// for login to succeed and for admin actions to actually pass RLS.
// Provisioning both sides is an operational/admin-console step, not
// something this client code can do without service-role credentials.

export const ADMIN_ROLES = ['admin', 'super_admin', 'instructor'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export interface AdminProfile {
  id: string
  full_name: string
  role: AdminRole
  created_at: string
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}

/**
 * Looks up the Firestore admin profile for a Firebase uid. Returns null
 * if no such document exists (i.e. this authenticated user is not an
 * admin) rather than throwing, so callers can treat "not an admin" as a
 * normal, expected outcome instead of an error state.
 */
export async function getAdminProfile(uid: string): Promise<AdminProfile | null> {
  const snap = await getDoc(doc(firestore, 'admins', uid))
  if (!snap.exists()) return null

  const data = snap.data()
  if (!isAdminRole(data.role)) return null

  return {
    id: uid,
    full_name: typeof data.full_name === 'string' ? data.full_name : '',
    role: data.role,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
  }
}