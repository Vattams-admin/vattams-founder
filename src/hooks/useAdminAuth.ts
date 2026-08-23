import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { getAdminProfile, type AdminProfile } from '@/lib/adminData'

interface AdminAuthState {
  /** The raw Firebase user, or null if not signed in at all. */
  adminUser: User | null
  /** The Firestore admin profile, or null if signed in but not an admin. */
  adminProfile: AdminProfile | null
  /** True only once we have a definite adminProfile with a valid role. */
  isAdmin: boolean
  /** True while Firebase auth state (and, if signed in, the admin-role
   * lookup) is still resolving. Route guards must wait for this to be
   * false before deciding to redirect, to avoid a false "not logged in"
   * redirect firing before Firebase has restored the session on refresh. */
  loading: boolean
}

/**
 * Tracks Firebase auth state and, if a user is signed in, whether they
 * also have a Firestore `admins/{uid}` doc with a valid role. Does not
 * redirect or sign anyone out — it only reports state; route guards
 * (e.g. AdminRoute) and AdminLogin decide what to do with it.
 */
export function useAdminAuth(): AdminAuthState {
  const [adminUser, setAdminUser] = useState<User | null>(null)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          if (!cancelled) {
            setAdminUser(null)
            setAdminProfile(null)
            setLoading(false)
          }
          return
        }

        if (!cancelled) setAdminUser(firebaseUser)

        try {
          const profile = await getAdminProfile(firebaseUser.uid)
          if (!cancelled) setAdminProfile(profile)
        } catch {
          // Firestore read failed (offline, rules, etc.) — treat as "not
          // confirmed admin" rather than leaving loading stuck forever.
          if (!cancelled) setAdminProfile(null)
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      (error) => {
        // Listener itself errored (e.g. broken Firebase config) — same
        // reasoning as useAuth.ts: never leave `loading` stuck true, or
        // AdminRoute's guard will spin forever instead of either
        // rendering the page or redirecting to /admin.
        console.error('Admin auth state listener error:', error)
        if (!cancelled) {
          setAdminUser(null)
          setAdminProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return {
    adminUser,
    adminProfile,
    isAdmin: adminProfile !== null,
    loading,
  }
}