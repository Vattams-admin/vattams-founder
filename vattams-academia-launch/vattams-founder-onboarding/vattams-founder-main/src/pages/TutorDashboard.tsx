import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { AcademyTutor } from '@/types/academy'

// There was no Tutor Dashboard anywhere in this project before — tutors
// who logged in landed on the Student Dashboard, which only shows
// enrolments/payments and is meaningless for a tutor account. This page
// is new (spec §11) and additive: it doesn't touch StudentDashboard,
// courses, classrooms, or payments.

type LoadState = 'loading' | 'loaded' | 'error' | 'not-found'

export default function TutorDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [tutor, setTutor] = useState<AcademyTutor | null>(null)
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(firestore, 'tutors', user.id))
        if (cancelled) return
        if (!snap.exists()) {
          setState('not-found')
          return
        }
        const data = snap.data()
        setTutor({
          id: snap.id,
          full_name: typeof data.full_name === 'string' ? data.full_name : '',
          email: typeof data.email === 'string' ? data.email : null,
          qualification: typeof data.qualification === 'string' ? data.qualification : null,
          expertise: typeof data.expertise === 'string' ? data.expertise : null,
          introduction: typeof data.introduction === 'string' ? data.introduction : null,
          role: typeof data.role === 'string' ? data.role : null,
          status: typeof data.status === 'string' ? data.status : null,
          approved_at: typeof data.approved_at === 'string' ? data.approved_at : null,
          approved_by: typeof data.approved_by === 'string' ? data.approved_by : null,
          rejected_at: null,
          rejected_by: null,
          rejection_reason: null,
          created_at: typeof data.created_at === 'string' ? data.created_at : '',
          employee_code: typeof data.employee_code === 'string' ? data.employee_code : null,
          tutor_id: typeof data.tutor_id === 'string' ? data.tutor_id : null,
          onboarding_status: typeof data.onboarding_status === 'string' ? data.onboarding_status : null,
          onboarded_at: typeof data.onboarded_at === 'string' ? data.onboarded_at : null,
          onboarded_by: typeof data.onboarded_by === 'string' ? data.onboarded_by : null,
        })
        setState('loaded')
      } catch (err) {
        console.error('Failed to load tutor profile:', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/tutor/dashboard' }} replace />

  if (state === 'not-found') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg">No tutor profile found for this account.</p>
        <p className="mt-2 text-sm text-slate-muted">
          If you registered as a student, visit your <Link to="/dashboard" className="underline">student dashboard</Link>{' '}
          instead.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Your Tutor Dashboard</h1>

      {state === 'loading' && <p className="mt-6 text-sm text-slate-muted">Loading…</p>}
      {state === 'error' && <p className="mt-6 text-sm text-danger">Unable to load your profile right now. Please try again.</p>}

      {state === 'loaded' && tutor && (
        <section className="mt-8 card p-6">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-gold">VATTAMS ACADEMIA</p>
          <h2 className="mt-2 font-display text-xl">Welcome, {tutor.full_name}</h2>

          {tutor.employee_code && tutor.tutor_id ? (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-muted">Employee Code</dt>
                  <dd className="mt-0.5 font-medium">{tutor.employee_code}</dd>
                </div>
                <div>
                  <dt className="text-slate-muted">Tutor ID</dt>
                  <dd className="mt-0.5 font-medium">{tutor.tutor_id}</dd>
                </div>
                <div>
                  <dt className="text-slate-muted">Status</dt>
                  <dd className="mt-0.5">
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
                      {tutor.onboarding_status ?? 'active'}
                    </span>
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/tutor/id-card" className="btn-secondary text-sm">View ID Card</Link>
                <Link to="/tutor/onboarding-letter" className="btn-secondary text-sm">View Onboarding Letter</Link>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-card border border-gold/30 bg-gold/5 p-4 text-sm">
              <p>
                Status:{' '}
                <span className="font-medium">
                  {tutor.status === 'approved' ? 'Approved — awaiting onboarding' : tutor.status === 'rejected' ? 'Rejected' : 'Under review'}
                </span>
              </p>
              <p className="mt-1 text-slate-muted">
                Your Employee Code and Tutor ID will appear here once an administrator completes onboarding.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
