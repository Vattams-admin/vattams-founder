import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/hooks/useAdminAuth'

// An earlier audit found that no /admin/* route was actually guarded —
// AdminLogin only self-redirected away *if already* an admin, but nothing
// stopped a signed-out visitor from loading /admin/payments or
// /admin/courses directly. This guard now wraps every /admin/* page in
// App.tsx (payments, courses, course form, course materials, students,
// tutors, notifications, certificates) except /admin and /admin/login
// themselves, which must stay reachable while signed out.
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { adminUser, isAdmin, loading, profileError } = useAdminAuth()
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

  // Signed in, but the admin-role lookup couldn't complete (offline,
  // Firestore unavailable, etc.) — this is not proof they aren't an admin,
  // so don't redirect them away and don't claim they lack access. Show a
  // retry option and let them stay signed in.
  if (!isAdmin && profileError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-lg">Unable to connect</p>
        <p className="max-w-sm text-sm text-slate-muted">
          Please check your internet connection and try again.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary text-sm">
          Retry
        </button>
      </div>
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