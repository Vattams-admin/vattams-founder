import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Payment } from '@/types/database'

interface EnrolmentRow {
  id: string
  status: string
  courses: { name: string; slug: string | null } | null
}

type SectionState = 'loading' | 'loaded' | 'error'

export default function StudentDashboard() {
  const { user, loading } = useAuth()
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([])
  const [enrolmentsState, setEnrolmentsState] = useState<SectionState>('loading')
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsState, setPaymentsState] = useState<SectionState>('loading')

  function loadEnrolments(userId: string) {
    setEnrolmentsState('loading')
    supabase
      .from('course_enrolments')
      .select('id, status, courses(name, slug)')
      .eq('student_id', userId)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load enrolments:', error)
          setEnrolmentsState('error')
          return
        }
        setEnrolments((data as unknown as EnrolmentRow[]) ?? [])
        setEnrolmentsState('loaded')
      })
  }

  function loadPayments(userId: string) {
    setPaymentsState('loading')
    supabase
      .from('payments')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load payment history:', error)
          setPaymentsState('error')
          return
        }
        setPayments((data as unknown as Payment[]) ?? [])
        setPaymentsState('loaded')
      })
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
              {e.status === 'active' && e.courses?.slug ? (
                <a href={`/learn/${e.courses.slug}`} className="hover:text-gold-bright">{e.courses?.name ?? 'Course'}</a>
              ) : (
                <span>{e.courses?.name ?? 'Course'}</span>
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

