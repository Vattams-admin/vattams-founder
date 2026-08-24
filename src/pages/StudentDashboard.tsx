import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Enrolment, Payment } from '@/types/database'

type SectionState = 'loading' | 'loaded' | 'error'

interface StudentIdentity {
  fullName: string
  studentCode: string | null
  studentId: string | null
  onboardingStatus: string | null
}

export default function StudentDashboard() {
  const { user, loading } = useAuth()
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [enrolmentsState, setEnrolmentsState] = useState<SectionState>('loading')
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsState, setPaymentsState] = useState<SectionState>('loading')
  const [identity, setIdentity] = useState<StudentIdentity | null>(null)

  async function loadIdentity(userId: string) {
    try {
      const snap = await getDoc(doc(firestore, 'students', userId))
      if (!snap.exists()) return
      const d = snap.data()
      setIdentity({
        fullName: typeof d.full_name === 'string' ? d.full_name : '',
        studentCode: typeof d.student_code === 'string' ? d.student_code : null,
        studentId: typeof d.student_id === 'string' ? d.student_id : null,
        onboardingStatus: typeof d.onboarding_status === 'string' ? d.onboarding_status : null,
      })
    } catch (err) {
      // Non-fatal — the rest of the dashboard (enrolments/payments)
      // still works without the identity section.
      console.error('Failed to load student identity:', err)
    }
  }

  async function loadEnrolments(userId: string) {
    setEnrolmentsState('loading')
    try {
      // course_name / course_slug are denormalized onto the enrolment
      // doc when it's created (see AdminPayments.tsx) — no join needed.
      const q = query(collection(firestore, 'enrolments'), where('student_id', '==', userId))
      const snapshot = await getDocs(q)
      setEnrolments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Enrolment[])
      setEnrolmentsState('loaded')
    } catch (err) {
      console.error('Failed to load enrolments:', err)
      setEnrolmentsState('error')
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

  useEffect(() => {
    if (!user) return
    loadEnrolments(user.id)
    loadPayments(user.id)
    loadIdentity(user.id)
  }, [user])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/dashboard' }} replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Your learning</h1>

      {identity && identity.studentCode && identity.studentId && (
        <section className="mt-6 card p-6">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-gold">VATTAMS ACADEMIA</p>
          <h2 className="mt-2 font-display text-xl">Welcome, {identity.fullName}</h2>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-muted">Student Code</dt>
              <dd className="mt-0.5 font-medium">{identity.studentCode}</dd>
            </div>
            <div>
              <dt className="text-slate-muted">Student ID</dt>
              <dd className="mt-0.5 font-medium">{identity.studentId}</dd>
            </div>
            <div>
              <dt className="text-slate-muted">Status</dt>
              <dd className="mt-0.5">
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
                  {identity.onboardingStatus ?? 'active'}
                </span>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/student/id-card" className="btn-secondary text-sm">View ID Card</Link>
            <Link to="/student/welcome-letter" className="btn-secondary text-sm">View Welcome Letter</Link>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl text-gold-bright">Enrolled courses</h2>
        {enrolmentsState === 'loading' && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {enrolmentsState === 'error' && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">
              Unable to connect right now. Please check your internet connection and try again.
            </p>
            <button onClick={() => loadEnrolments(user.id)} className="btn-secondary text-xs">
              Retry
            </button>
          </div>
        )}
        {enrolmentsState === 'loaded' && enrolments.length === 0 && (
          <p className="mt-2 text-sm text-slate-muted">
            No enrolments yet. Browse the <a href="/courses" className="underline">course catalogue</a> to get started.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {enrolmentsState === 'loaded' && enrolments.map((e) => (
            <div key={e.id} className="card flex items-center justify-between p-4">
              {e.status === 'active' && e.course_slug ? (
                <a href={`/learn/${e.course_slug}`} className="hover:text-gold-bright">{e.course_name ?? 'Course'}</a>
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
                <p>₹{p.amount.toLocaleString('en-IN')}</p>
                {p.utr_reference && <p className="text-xs text-slate-muted">UTR: {p.utr_reference}</p>}
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