import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Enrolment, Payment } from '@/types/database'
import NextLiveSessionCard from '@/components/live-session/NextLiveSessionCard'

type SectionState = 'loading' | 'loaded' | 'error'

export default function StudentDashboard() {
  const { user, loading } = useAuth()
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [enrolmentsState, setEnrolmentsState] = useState<SectionState>('loading')
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsState, setPaymentsState] = useState<SectionState>('loading')

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
  }, [user])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/dashboard' }} replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Your learning</h1>

      <section className="mt-6">
        <NextLiveSessionCard studentUid={user.id} />
      </section>

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