import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import type { Payment } from '@/types/database'

// Postgres had a trigger (activate_enrolment_on_payment_approval) that
// auto-created/activated the matching course_enrolments row whenever a
// payment flipped to 'approved'. Firestore has no triggers here (no
// Cloud Functions in this repo), so that step is done explicitly below,
// right after the payment status update — this is now the ONLY place
// enrolment activation happens, same as the trigger was the only place.
//
// No manual join/lookup is needed for the list itself: Payment.tsx
// already denormalizes course_name + student_name onto the payment doc
// at creation time, so this page just reads the payments collection
// directly.

export default function AdminPayments() {
  const [rows, setRows] = useState<Payment[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    try {
      // Requires a composite index on (status, submitted_at) — Firestore
      // will show a console link to create it the first time this runs
      // if it's missing.
      const snapshot = await getDocs(
        query(
          collection(firestore, 'payments'),
          where('status', '==', 'submitted'),
          orderBy('submitted_at', 'asc')
        )
      )
      setRows(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment))
    } catch (err) {
      console.error('Unexpected error loading payments:', err)
      setLoadError(true)
    }
  }

  useEffect(() => { load() }, [])

  async function activateEnrolment(row: Payment) {
    // Deterministic id (student_id_course_id) instead of a uuid — this is
    // what gives us Postgres's `on conflict (student_id, course_id) do
    // update` behaviour for free: writing to the same doc id again just
    // updates it instead of creating a duplicate enrolment.
    const enrolmentId = `${row.student_id}_${row.course_id}`
    const enrolmentRef = doc(firestore, 'enrolments', enrolmentId)

    const [enrolmentSnap, courseSnap] = await Promise.all([
      getDoc(enrolmentRef),
      getDoc(doc(firestore, 'courses', row.course_id))
    ])

    const courseSlug = courseSnap.exists() ? (courseSnap.data().slug as string | undefined) ?? null : null

    await setDoc(
      enrolmentRef,
      {
        student_id: row.student_id,
        course_id: row.course_id,
        course_name: row.course_name,
        course_slug: courseSlug,
        status: 'active',
        enrolled_at: new Date().toISOString(),
        // Only stamp created_at the first time this doc is written —
        // `on conflict ... do update` never touched created_at either.
        ...(enrolmentSnap.exists() ? {} : { created_at: new Date().toISOString() })
      },
      { merge: true }
    )
  }

  async function decide(row: Payment, status: 'approved' | 'rejected') {
    setBusyId(row.id)
    setError(null)
    try {
      await updateDoc(doc(firestore, 'payments', row.id), {
        status,
        verified_at: new Date().toISOString()
      })

      if (status === 'approved') {
        await activateEnrolment(row)
      }

      setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null)
    } catch (err) {
      console.error('Unexpected error updating payment status:', err)
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
        Approving a payment automatically activates the matching enrolment — no manual follow-up step.
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