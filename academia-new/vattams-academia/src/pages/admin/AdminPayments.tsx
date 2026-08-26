import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AdminNav from '@/components/AdminNav'

interface PaymentRow {
  id: string
  amount: number
  status: string
  utr_reference: string | null
  submitted_at: string | null
  students: { full_name: string } | null
  courses: { name: string } | null
}

export default function AdminPayments() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, status, utr_reference, submitted_at, students(full_name), courses(name)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })

    if (error) setError(error.message)
    else setRows(data as unknown as PaymentRow[])
  }

  useEffect(() => { load() }, [])

  async function decide(id: string, status: 'approved' | 'rejected') {
    setBusyId(id)
    const { error } = await supabase
      .from('payments')
      .update({ status, verified_at: new Date().toISOString() })
      .eq('id', id)
    setBusyId(null)
    if (error) setError(error.message)
    else setRows((prev) => prev?.filter((r) => r.id !== id) ?? null)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <AdminNav active="payments" />
      <h1 className="mt-6 font-display text-3xl">Payments awaiting verification</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Approving a payment automatically activates the matching enrolment — no manual follow-up step.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {rows === null && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}
      {rows?.length === 0 && <p className="mt-8 text-sm text-slate-muted">Nothing pending. All caught up.</p>}

      <div className="mt-6 space-y-3">
        {rows?.map((r) => (
          <div key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">{r.students?.full_name ?? 'Student'} — {r.courses?.name ?? 'Course'}</p>
              <p className="text-slate-muted">₹{r.amount.toLocaleString('en-IN')} · UTR: {r.utr_reference}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide(r.id, 'approved')}
                disabled={busyId === r.id}
                className="rounded-card bg-success px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={() => decide(r.id, 'rejected')}
                disabled={busyId === r.id}
                className="rounded-card border border-danger/50 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
