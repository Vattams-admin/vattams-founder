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
  const { adminUser, isAdmin, loading } = useAdminAuth()
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
      <Navigate
        to="/admin/login"
        state={{ notice: 'This account does not have admin access.' }}
        replace
      />
    )
  }

  return <>{children}</>
}
