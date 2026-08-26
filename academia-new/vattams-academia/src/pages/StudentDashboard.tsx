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

export default function StudentDashboard() {
  const { user, loading } = useAuth()
  const [enrolments, setEnrolments] = useState<EnrolmentRow[] | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('course_enrolments')
      .select('id, status, courses(name, slug)')
      .eq('student_id', user.id)
      .then(({ data }) => setEnrolments((data as unknown as EnrolmentRow[]) ?? []))

    supabase
      .from('payments')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments((data as unknown as Payment[]) ?? []))
  }, [user])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/dashboard' }} replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Your learning</h1>

      <section className="mt-8">
        <h2 className="font-display text-xl text-gold-bright">Enrolled courses</h2>
        {enrolments === null && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {enrolments?.length === 0 && (
          <p className="mt-2 text-sm text-slate-muted">
            No enrolments yet. Browse the <a href="/courses" className="underline">course catalogue</a> to get started.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {enrolments?.map((e) => (
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
        {payments === null && <p className="mt-2 text-sm text-slate-muted">Loading…</p>}
        {payments?.length === 0 && <p className="mt-2 text-sm text-slate-muted">No payments yet.</p>}
        <div className="mt-4 divide-y divide-white/10 rounded-card border border-white/10">
          {payments?.map((p) => (
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
