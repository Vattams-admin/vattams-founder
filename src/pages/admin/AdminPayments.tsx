import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import type { Payment } from '@/types/database'

export default function AdminPayments() {
  const [rows, setRows] = useState<Payment[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    try {
      // course_name / student_name are denormalized onto the payment doc
      // at creation time (see Payment.tsx) — Firestore has no joins, so
      // this is a single-collection read instead of the old
      // students(...)/courses(...) select.
      const q = query(collection(firestore, 'payments'), where('status', '==', 'submitted'))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Payment[]
      data.sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
      setRows(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
      setLoadError(true)
    }
  }

  useEffect(() => { load() }, [])

  async function decide(payment: Payment, status: 'approved' | 'rejected') {
    setBusyId(payment.id)
    setError(null)
    try {
      await updateDoc(doc(firestore, 'payments', payment.id), {
        status,
        verified_at: new Date().toISOString()
      })

      // Firestore has no server-side triggers, so the enrolment
      // activation that Supabase used to do in
      // activate_enrolment_on_payment_approval() happens here instead,
      // right after the payment update succeeds. Doc id is
      // student_id_course_id so this "upsert" (setDoc + merge) plays
      // the same role as the old `on conflict (student_id, course_id)`.
      if (status === 'approved') {
        // Fetched fresh so the enrolment carries the course's current
        // slug (needed by StudentDashboard's "go to lesson" link) —
        // course_slug isn't on the payment doc itself.
        const courseSnap = await getDoc(doc(firestore, 'courses', payment.course_id))
        const courseSlug = courseSnap.exists() ? (courseSnap.data().slug as string | undefined) ?? null : null

        const enrolmentId = `${payment.student_id}_${payment.course_id}`
        await setDoc(
          doc(firestore, 'enrolments', enrolmentId),
          {
            student_id: payment.student_id,
            course_id: payment.course_id,
            course_name: payment.course_name,
            course_slug: courseSlug,
            status: 'active',
            enrolled_at: new Date().toISOString(),
            created_at: serverTimestamp()
          },
          { merge: true }
        )
      }

      setRows((prev) => prev?.filter((r) => r.id !== payment.id) ?? null)
    } catch (err) {
      console.error('Failed to update payment status:', err)
      setError('Unable to save this decision right now. Please check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <AdminNav active="payments" />
      <h1 className="mt-6 font-display text-3xl">Payments awaiting verification</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Approving a payment activates the matching enrolment right away — no manual follow-up step.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {loadError && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Unable to connect</p>
          <p className="mt-2 text-sm text-slate-muted">
            Please check your internet connection and try again.
          </p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {!loadError && rows === null && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}
      {!loadError && rows?.length === 0 && <p className="mt-8 text-sm text-slate-muted">Nothing pending. All caught up.</p>}

      <div className="mt-6 space-y-3">
        {!loadError && rows?.map((r) => (
          <div key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">{r.student_name ?? 'Student'} — {r.course_name ?? 'Course'}</p>
              <p className="text-slate-muted">₹{r.amount.toLocaleString('en-IN')} · UTR: {r.utr_reference}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decide(r, 'approved')}
                disabled={busyId === r.id}
                className="rounded-card bg-success px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={() => decide(r, 'rejected')}
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