import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

// Admin identity is Firebase-only: Firebase Auth verifies the password,
// and admin authorization is a Firestore document at
// admin_users/{firebaseUid} — no Supabase involved anywhere in this
// flow. The document's existence (plus is_active === true and a
// recognized role) is what grants admin access.
//
// These documents are NOT created by the app — there is no signup flow
// for admins. Create them by hand in the Firebase Console:
//   Firestore Database → admin_users collection → Add document
//   Document ID: the admin's Firebase Auth UID (Authentication → Users
//   → copy the UID next to their email)
//   Fields: full_name (string), role (string: "admin" | "super_admin" |
//   "instructor"), is_active (boolean: true), created_at (timestamp,
//   optional)

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
 * Looks up admin authorization for a signed-in Firebase user by uid,
 * via the admin_users/{uid} Firestore document. Returns null if the
 * document doesn't exist, is_active isn't true, or the role isn't a
 * recognized admin role — all treated as "not an admin" rather than an
 * error, so callers can show "this account does not have admin access"
 * as a normal outcome. Throws only on an actual read failure (offline,
 * Firestore security rules blocking the read, etc.), which callers
 * should treat as "couldn't confirm" rather than "confirmed not admin."
 */
export async function getAdminProfile(uid: string | null | undefined): Promise<AdminProfile | null> {
  if (!uid) return null

  const snapshot = await getDoc(doc(firestore, 'admin_users', uid))

  if (!snapshot.exists()) return null

  const data = snapshot.data()
  if (data.is_active !== true) return null
  if (!isAdminRole(data.role)) return null

  const createdAt = data.created_at
  const createdAtIso =
    createdAt && typeof createdAt.toDate === 'function'
      ? createdAt.toDate().toISOString()
      : typeof createdAt === 'string'
        ? createdAt
        : ''

  return {
    id: snapshot.id,
    full_name: typeof data.full_name === 'string' ? data.full_name : '',
    role: data.role,
    created_at: createdAtIso,
  }
}