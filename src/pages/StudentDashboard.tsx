import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'
import { getNextLiveSessionForStudent } from '@/lib/liveSessions'
import type { LiveSession } from '@/types/liveSession'
import { useAuth } from '@/hooks/useAuth'
import type { Course, Enrolment, Payment } from '@/types/database'
import EmailVerificationBanner from '@/components/EmailVerificationBanner'

type SectionState = 'loading' | 'loaded' | 'error'

export default function StudentDashboard() {
  const { user, loading } = useAuth()
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({})
  const [enrolmentsState, setEnrolmentsState] = useState<SectionState>('loading')
  const [enrolmentsError, setEnrolmentsError] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsState, setPaymentsState] = useState<SectionState>('loading')
  const [nextLiveSession, setNextLiveSession] = useState<LiveSession | null>(null)
  const [liveSessionState, setLiveSessionState] = useState<SectionState>('loading')
  const [activeCompetitions, setActiveCompetitions] = useState<Course[]>([])
  const [competitionsState, setCompetitionsState] = useState<SectionState>('loading')

  async function loadEnrolments(userId: string) {
    setEnrolmentsState('loading')
    try {
      // course_name / course_slug are denormalized onto the enrolment
      // doc when it's created (see AdminPayments.tsx) — no join needed.
      const q = query(collection(firestore, 'enrolments'), where('student_id', '==', userId))
      const snapshot = await getDocs(q)
      const loadedEnrolments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Enrolment[]
      setEnrolments(loadedEnrolments)

      const courseIds = [...new Set(
        loadedEnrolments
          .map((enrolment) => enrolment.course_id)
          .filter((courseId): courseId is string => Boolean(courseId))
      )]

      if (courseIds.length > 0) {
        const courseSnapshot = await getDocs(query(collection(firestore, 'courses'), where('is_published', '==', true)))
        const courses = courseSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Course)
          .filter((course) => courseIds.includes(course.id))

        const nextCourseMap: Record<string, Course> = {}
        for (const course of courses) {
          nextCourseMap[course.id] = course
        }
        setCourseMap(nextCourseMap)
      } else {
        setCourseMap({})
      }

      setEnrolmentsState('loaded')
    } catch (err) {
      console.error('Failed to load enrolments:', err)
      const firebaseError = err as { code?: string; message?: string }
      setEnrolmentsState('error')
      setEnrolmentsError(
        firebaseError.code
          ? `${firebaseError.code}: ${firebaseError.message ?? 'Unknown Firebase error'}`
          : String(err)
      )
    }
  }

  async function loadPayments(userId: string) {
    setPaymentsState('loading')
    try {
      const q = query(collection(firestore, 'payments'), where('student_id', '==', userId))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Payment[]
      data.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setPayments(data)
      setPaymentsState('loaded')
    } catch (err) {
      console.error('Failed to load payment history:', err)
      setPaymentsState('error')
    }
  }

  async function loadActiveCompetitions() {
    setCompetitionsState('loading')
    try {
      const q = query(collection(firestore, 'courses'), where('is_published', '==', true), where('is_competition', '==', true))
      const snapshot = await getDocs(q)
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Course).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      setActiveCompetitions(rows)
      setCompetitionsState('loaded')
    } catch (err) {
      console.error('Failed to load active competitions:', err)
      setCompetitionsState('error')
    }
  }
  async function loadNextLiveSession(userId: string) {
    setLiveSessionState('loading')
    try {
      const session = await getNextLiveSessionForStudent(userId)
      setNextLiveSession(session)
      setLiveSessionState('loaded')
    } catch (err) {
      console.error('Failed to load next live session:', err)
      setLiveSessionState('error')
    }
  }

  useEffect(() => {
    if (!user) return
    loadEnrolments(user.id)
    loadPayments(user.id)
    loadNextLiveSession(user.id)
    loadActiveCompetitions()
  }, [user])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/dashboard' }} replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Your learning</h1>

      <div className="mt-6">
        {firebaseAuth.currentUser && (
          <EmailVerificationBanner user={firebaseAuth.currentUser} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link to="/student/id-card" className="font-medium text-gold hover:text-gold-bright">
          View ID card
        </Link>
        <Link to="/student/welcome-letter" className="font-medium text-gold hover:text-gold-bright">
          Welcome letter
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl text-gold-bright">Next Live Class</h2>
        {liveSessionState === 'loading' && (
          <p className="mt-2 text-sm text-slate-muted">Loading…</p>
        )}
        {liveSessionState === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">
              Unable to load live classes right now.
            </p>
            <button
              onClick={() => loadNextLiveSession(user.id)}
              className="btn-secondary text-xs"
            >
              Retry
            </button>
          </div>
        )}
        {liveSessionState === 'loaded' && !nextLiveSession && (
          <p className="mt-2 text-sm text-slate-muted">
            No upcoming live classes.
          </p>
        )}
        {liveSessionState === 'loaded' && nextLiveSession && (
          <div className="card mt-4 flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{nextLiveSession.title}</p>
              <p className="text-sm text-slate-muted">
                {nextLiveSession.course_name ?? 'Course'}
                {nextLiveSession.tutor_name ? ` · ${nextLiveSession.tutor_name}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-muted">
                {new Date(nextLiveSession.start_time).toLocaleString('en-IN')}
              </p>
            </div>
            <Link
              to={`/live-session/${nextLiveSession.id}`}
              className="btn-primary text-sm"
            >
              View Live Class
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-gold-bright">Active Competitions</h2>
            <p className="mt-1 text-sm text-slate-muted">Compete, prepare and build your academic profile.</p>
          </div>
          <Link to="/competitions" className="text-sm font-medium text-gold hover:text-gold-bright">View all</Link>
        </div>
        {competitionsState === 'loading' && <p className="mt-3 text-sm text-slate-muted">Loading competitions…</p>}
        {competitionsState === 'error' && <p className="mt-3 text-sm text-danger">Unable to load competitions right now.</p>}
        {competitionsState === 'loaded' && activeCompetitions.length === 0 && <p className="mt-3 text-sm text-slate-muted">No active competitions right now.</p>}
        {competitionsState === 'loaded' && activeCompetitions.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeCompetitions.map((competition) => (
              <Link key={competition.id} to={`/competition/${competition.slug}`} className="card flex items-center justify-between gap-4 p-4 hover:border-gold/30">
                <div>
                  <p className="font-medium">{competition.name}</p>
                  <p className="mt-1 text-xs text-slate-muted">Official competition · Study Materials · Mock Test</p>
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gold">View →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl text-gold-bright">Enrolled courses</h2>
        {enrolmentsState === 'loading' && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {enrolmentsState === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">
              Unable to connect right now. Please check your internet connection and try again.
            </p>
            {enrolmentsError && (
              <p className="mt-1 break-all text-xs text-slate-muted">
                Diagnostic: {enrolmentsError}
              </p>
            )}
            <button onClick={() => loadEnrolments(user.id)} className="btn-secondary text-xs">
              Retry
            </button>
          </div>
        )}
        {enrolmentsState === 'loaded' && enrolments.length === 0 && (
          <p className="mt-2 text-sm text-slate-muted">
            No enrolments yet. Browse the <Link to="/courses" className="underline">course catalogue</Link> to get started.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {enrolmentsState === 'loaded' && enrolments.map((e) => (
            <div key={e.id} className="card flex items-center justify-between p-4">
              {e.status === 'active' && e.course_slug ? (
                <Link
                              to={
                                courseMap[e.course_id ?? '']?.is_competition
                                  ? `/competition/${e.course_slug}`
                                  : `/learn/${e.course_slug}`
                              }
                              className="hover:text-gold-bright"
                            >
                              {e.course_name ?? 'Course'}
                            </Link>
              ) : (
                <span>{e.course_name ?? 'Course'}</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                  e.status === 'active' ? 'bg-success/20 text-success' : 'bg-gold/20 text-gold'
                }`}
              >
                {e.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-gold-bright">Payment history</h2>
        {paymentsState === 'loading' && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {paymentsState === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">
              Unable to connect right now. Please check your internet connection and try again.
            </p>
            <button onClick={() => loadPayments(user.id)} className="btn-secondary text-xs">
              Retry
            </button>
          </div>
        )}
        {paymentsState === 'loaded' && payments.length === 0 && <p className="mt-2 text-sm text-slate-muted">No payments yet.</p>}
        <div className="mt-4 divide-y divide-white/10 rounded-card border border-white/10">
          {paymentsState === 'loaded' && payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{p.course_name ?? 'Course'}</p>
                <p>₹{p.amount.toLocaleString('en-IN')}</p>
                {p.utr_reference && <p className="text-xs text-slate-muted">UTR: {p.utr_reference}</p>}
                <p className="text-xs text-slate-muted">
                  {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {p.status === 'rejected' && p.admin_notes && (
                  <p className="mt-1 text-xs text-danger">Reason: {p.admin_notes}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                  p.status === 'approved'
                    ? 'bg-success/20 text-success'
                    : p.status === 'rejected'
                    ? 'bg-danger/20 text-danger'
                    : 'bg-gold/20 text-gold'
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}