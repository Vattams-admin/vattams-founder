import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'

// Phase 1 audit found that no /admin/* route was actually guarded —
// AdminLogin only self-redirected away *if already* an admin, but nothing
// stopped a signed-out visitor from loading /admin/payments or
// /admin/courses directly. Phase 2 requires the two new admin pages
// (students, tutors) to not expose data to unauthenticated users, so this
// guard is introduced and applied to those two new routes. The
// pre-existing unguarded routes (/admin/payments, /admin/courses,
// /admin/courses/:id) are left as-is — wrapping them was not requested
// here and is a one-line change to apply later if wanted.
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { adminUser, adminProfile, isAdmin, loading, authError } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    )
  }

  if (!adminUser) {
    return (
      <Navigate
        to="/admin/login"
        state={{ notice: 'Please sign in to continue.', redirectTo: location.pathname }}
        replace
      />
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <h1 className="font-display text-3xl text-gold">
          Admin verification failed
        </h1>

        <div className="mt-6 rounded-card border border-red-400/30 bg-red-400/10 p-5 text-sm">
          <p><strong>Firebase user:</strong> {adminUser ? 'YES' : 'NO'}</p>
          <p className="mt-2"><strong>UID:</strong> {adminUser?.uid ?? 'NONE'}</p>
          <p className="mt-2"><strong>Admin profile:</strong> {adminProfile ? 'FOUND' : 'NOT FOUND'}</p>
          <p className="mt-2"><strong>Reason:</strong> {authError ?? 'Unknown'}</p>
        </div>

        <a
          href="/admin/login"
          className="mt-6 inline-block rounded-card bg-gold px-5 py-3 font-semibold text-ink"
        >
          Back to Admin Login
        </a>
      </div>
    )
  }

  return <>{children}</>
}
