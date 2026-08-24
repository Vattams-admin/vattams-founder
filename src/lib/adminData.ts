import { supabase } from '@/lib/supabase'

// Admin identity lives in Supabase's public.admin_users table, keyed by
// email — NOT in Firestore, and NOT by Firebase uid. Firebase Auth is the
// authentication system (it verifies the password); this lookup is the
// authorization check that runs after Firebase confirms who the person
// is, using the email Firebase already validated. admin_users.password_hash
// is unrelated to Firebase auth and is never read here.

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
 * Looks up the public.admin_users row for a signed-in Firebase user's
 * email. Returns null if there is no matching row, the row is inactive
 * (is_active !== true), or the role isn't a recognized admin role — all
 * treated as "not an admin" rather than an error, so callers can show
 * "this account does not have admin access" as a normal outcome. Throws
 * only on an actual query failure (offline, RLS misconfiguration, etc.),
 * which callers should treat as "couldn't confirm" rather than "confirmed
 * not admin."
 */
export async function getAdminProfile(email: string | null | undefined): Promise<AdminProfile | null> {
  if (!email) return null

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, full_name, role, is_active, created_at')
    .ilike('email', email.trim())
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  if (data.is_active !== true) return null
  if (!isAdminRole(data.role)) return null

  return {
    id: data.id,
    full_name: typeof data.full_name === 'string' ? data.full_name : '',
    role: data.role,
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
  }
}