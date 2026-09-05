import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import type { Payment } from '@/types/database'
import { createAdminBroadcast, createNotification } from '@/lib/notifications'
import { decideTutorRegistrationPayment } from '@/lib/tutorPayments'

export default function AdminPayments() {
  const { adminUser } = useAdminAuth()
  const [rows, setRows] = useState<Payment[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})

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
    const note = rejectNotes[payment.id]?.trim() || null
    setBusyId(payment.id)
    setError(null)

    // Tutor registration fee: no course and no enrolment.
    if (payment.payment_type === 'tutor_registration') {
      const { error: decideError } = await decideTutorRegistrationPayment(
        payment,
        status,
        adminUser!.uid,
        note
      )
      setBusyId(null)

      if (decideError) {
        setError(decideError)
        return
      }

      setRejectNotes((prev) => {
        const next = { ...prev }
        delete next[payment.id]
        return next
      })
      setRows((prev) => prev?.filter((r) => r.id !== payment.id) ?? null)
      return
    }

    // Course payments require both references.
    if (!payment.course_id || !payment.student_id) {
      setBusyId(null)
      setError('This payment is missing a course or student reference and cannot be processed here.')
      return
    }

    const courseId = payment.course_id
    const studentId = payment.student_id

    try {
      // Course slug lookup is read-only reference data (used only for the
      // student notification's deep link) — not part of the authoritative
      // state being changed, so it's fetched before the transaction rather
      // than inside it.
      let courseSlug: string | null = null
      if (status === 'approved') {
        const courseSnap = await getDoc(doc(firestore, 'courses', courseId))
        courseSlug = courseSnap.exists() ? (courseSnap.data().slug as string | undefined) ?? null : null
      }

      const enrolmentId = `${studentId}_${courseId}`
      const paymentRef = doc(firestore, 'payments', payment.id)
      const enrolmentRef = doc(firestore, 'enrolments', enrolmentId)

      // Firestore has no server-side triggers, so the enrolment
      // activation that Supabase used to do in
      // activate_enrolment_on_payment_approval() happens here instead.
      // Wrapped in a transaction so the payment's status flip and the
      // enrolment's activation commit together or not at all — a
      // dropped connection between the two can no longer leave an
      // "approved" payment with no active enrolment (or vice versa).
      // The transaction also re-reads the payment first as an
      // idempotency guard: if it's already been decided (e.g. a second
      // admin tab, or a double click that slipped past `busyId`), this
      // is a no-op instead of a duplicate enrolment write / duplicate
      // notifications.
      const result = await runTransaction(firestore, async (tx) => {
        const freshSnap = await tx.get(paymentRef)
        if (!freshSnap.exists()) {
          throw new Error('This payment no longer exists.')
        }
        if (freshSnap.data().status !== 'submitted') {
          return { alreadyProcessed: true }
        }

        tx.update(paymentRef, {
          status,
          verified_at: new Date().toISOString(),
          // adminUser is guaranteed non-null here: this page is only
          // reachable behind AdminRoute, which never renders children
          // until an authenticated admin is confirmed.
          verified_by: adminUser!.uid,
          admin_notes: note
        })

        if (status === 'approved') {
          // setDoc(..., { merge: true }) semantics via transaction.set —
          // doc id is student_id_course_id, so re-approving (should that
          // ever happen) safely converges on the same enrolment record
          // rather than creating a duplicate.
          tx.set(
            enrolmentRef,
            {
              student_id: studentId,
              course_id: courseId,
              course_name: payment.course_name,
              course_slug: courseSlug,
              status: 'active',
              enrolled_at: new Date().toISOString(),
              created_at: serverTimestamp()
            },
            { merge: true }
          )
        }

        return { alreadyProcessed: false }
      })

      if (result.alreadyProcessed) {
        setRows((prev) => prev?.filter((r) => r.id !== payment.id) ?? null)
        return
      }

      if (status === 'approved') {
        // Three student-facing notifications, never blocking the
        // approval itself (see createNotification() doc comment).
        // payment_success and enrollment_success are genuinely distinct
        // events here (a payment can exist without an active enrolment
        // yet, e.g. mid-verification), but this app has no separate
        // access-gating step beyond the enrolment going active, so
        // course_access_granted is folded into the same enrollment_success
        // moment rather than firing as a fourth near-duplicate notification
        // — see delivery report.
        void createNotification({
          recipient_uid: studentId,
          recipient_role: 'student',
          type: 'payment_success',
          title: 'Payment verified',
          message: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.course_name ?? 'your course'} has been verified.`,
          related_id: payment.id,
          related_type: 'payment',
          action_url: '/dashboard',
        })
        void createNotification({
          recipient_uid: studentId,
          recipient_role: 'student',
          type: 'enrollment_success',
          title: 'Enrollment activated',
          message: `You're enrolled in ${payment.course_name ?? 'your course'}. Course access has been granted.`,
          related_id: enrolmentId,
          related_type: 'enrolment',
          action_url: courseSlug ? `/learn/${courseSlug}` : '/dashboard',
        })
        void createAdminBroadcast({
          type: 'new_enrollment',
          title: 'New enrollment activated',
          message: `${payment.student_name ?? 'A student'} is now enrolled in ${payment.course_name ?? 'a course'}.`,
          related_id: enrolmentId,
          related_type: 'enrolment',
          action_url: '/admin/payments',
        })
      }

      if (status === 'rejected') {
        void createNotification({
          recipient_uid: studentId,
          recipient_role: 'student',
          type: 'payment_rejected',
          title: 'Payment could not be verified',
          message: note
            ? `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.course_name ?? 'your course'} was rejected: ${note}`
            : `Your payment of ₹${payment.amount.toLocaleString('en-IN')} for ${payment.course_name ?? 'your course'} could not be verified. Please check your reference and try again.`,
          related_id: payment.id,
          related_type: 'payment',
          action_url: '/dashboard',
        })
      }

      setRejectNotes((prev) => {
        const next = { ...prev }
        delete next[payment.id]
        return next
      })
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
              <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                r.payment_type === 'tutor_registration'
                  ? 'bg-gold/20 text-gold-bright'
                  : 'bg-white/10 text-slate-muted'
              }`}>
                {r.payment_type === 'tutor_registration' ? 'Tutor registration' : 'Course payment'}
              </span>
              <p className="font-medium">
                {r.payment_type === 'tutor_registration'
                  ? r.tutor_name ?? 'Tutor'
                  : `${r.student_name ?? 'Student'} — ${r.course_name ?? 'Course'}`}
              </p>
              <p className="text-slate-muted">₹{r.amount.toLocaleString('en-IN')} · UTR: {r.utr_reference}</p>
              <p className="text-xs text-slate-muted">
                Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-IN') : '—'}
              </p>
              <input
                value={rejectNotes[r.id] ?? ''}
                onChange={(e) => setRejectNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="Rejection reason (optional, shown to student if rejected)"
                className="mt-2 w-full max-w-sm rounded-card border border-white/15 bg-ink px-2 py-1 text-xs outline-none focus:border-gold"
              />
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