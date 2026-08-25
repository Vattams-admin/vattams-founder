// src/pages/Payment.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Course, Payment } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { createAdminBroadcast } from '@/lib/notifications'

const PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME || 'VATTAMS ACADEMIA'
const PAYEE_VPA = import.meta.env.VITE_UPI_VPA as string | undefined

const CONNECTION_ERROR = 'Unable to connect right now. Please check your internet connection and try again.'

export default function Payment() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { redirectTo: `/pay/${courseId}` } })
      return
    }
    if (!courseId) {
      setNotFound(true)
      return
    }
    let cancelled = false

    async function init() {
      setError(null)
      setNotFound(false)

      try {
        // `courseId` is the Firestore document id — same as CourseDetail.tsx
        // (`{ id: docSnap.id, ...docSnap.data() }`), so a direct doc get
        // is enough; no query needed like the slug-based pages.
        const courseSnap = await getDoc(doc(firestore, 'courses', courseId as string))
        if (cancelled) return

        if (!courseSnap.exists()) {
          setNotFound(true)
          return
        }
        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course
        setCourse(courseData)

        // Reuse an existing pending/submitted payment for this
        // student+course instead of creating duplicates on every visit.
        // Requires a composite index on (student_id, course_id, status,
        // created_at) — Firestore will show a console link to create it
        // the first time this query runs if it's missing.
        const existingQuery = query(
          collection(firestore, 'payments'),
          where('student_id', '==', user!.id),
          where('course_id', '==', courseId),
          where('status', 'in', ['pending', 'submitted']),
          orderBy('created_at', 'desc'),
          limit(1)
        )
        const existingSnapshot = await getDocs(existingQuery)
        if (cancelled) return

        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0]
          setPayment({ id: existingDoc.id, ...existingDoc.data() } as Payment)
          return
        }

        const amount = Math.max(courseData.base_fee - courseData.discount_amount, 0)
        const newPayment = {
          student_id: user!.id,
          course_id: courseId,
          // Denormalized so payment lists (admin + student dashboard) can
          // render without a join — Firestore has none.
          course_name: courseData.name,
          student_name: user!.displayName ?? user!.email ?? null,
          amount,
          status: 'pending' as const,
          utr_reference: null,
          submitted_at: null,
          verified_at: null,
          verified_by: null,
          admin_notes: null,
          created_at: new Date().toISOString()
        }
        const createdRef = await addDoc(collection(firestore, 'payments'), newPayment)
        if (cancelled) return
        setPayment({ id: createdRef.id, ...newPayment } as Payment)
      } catch (err) {
        // Guards against anything that escapes the Firestore calls above
        // leaving this page stuck on "Loading payment details…" forever.
        if (cancelled) return
        console.error('Unexpected error loading payment page:', err)
        setError(CONNECTION_ERROR)
      }
    }

    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user, retryToken])

  async function submitUtr() {
    if (!payment || !utr.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await updateDoc(doc(firestore, 'payments', payment.id), {
        utr_reference: utr.trim(),
        status: 'submitted',
        submitted_at: new Date().toISOString()
      })
      setPayment({ ...payment, utr_reference: utr.trim(), status: 'submitted' })

      // Lets the admin team know a payment is waiting on
      // /admin/payments without needing to poll the page. Never blocks
      // or fails the submission itself — see createNotification() in
      // src/lib/notifications.ts.
      void createAdminBroadcast({
        type: 'payment_received',
        title: 'Payment awaiting verification',
        message: `${user!.displayName ?? user!.email ?? 'A student'} submitted a UTR for ${course?.name ?? 'a course'} (₹${payment.amount.toLocaleString('en-IN')}).`,
        related_id: payment.id,
        related_type: 'payment',
        action_url: '/admin/payments',
      })
    } catch (err) {
      console.error('Unexpected error submitting payment reference:', err)
      setError('Unable to submit right now. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-muted">
        <p className="font-display text-lg text-parchment">Course not found</p>
        <p className="mt-2 text-sm">This course may no longer be available.</p>
      </div>
    )
  }

  if (!course || !payment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-muted">
        <p>{error ?? 'Loading payment details…'}</p>
        {error && (
          <button onClick={() => setRetryToken((t) => t + 1)} className="btn-primary mt-4">
            Retry
          </button>
        )}
      </div>
    )
  }

  const courseDisplayName = getCourseDisplayName(course.name)

  const upiLink = PAYEE_VPA
    ? `upi://pay?pa=${encodeURIComponent(PAYEE_VPA)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${payment.amount}&cu=INR&tn=${encodeURIComponent(
        `VATTAMS ACADEMIA - ${courseDisplayName}`
      )}`
    : null

  if (payment.status === 'submitted') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Payment submitted</h1>
        <p className="mt-3 text-slate-muted">
          We&apos;ve received your reference <span className="text-parchment">{payment.utr_reference}</span>.
          An admin will verify it and your enrolment will activate automatically — you&apos;ll see it on your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">Complete your payment</h1>

      <div className="card mt-6 divide-y divide-white/10">
        <div className="flex items-center justify-between p-4 text-sm">
          <span className="text-slate-muted">Programme</span>
          <span className="font-medium">{courseDisplayName}</span>
        </div>
        <div className="flex items-center justify-between p-4 text-sm">
          <span className="text-slate-muted">Base fee</span>
          <span>₹{course.base_fee.toLocaleString('en-IN')}</span>
        </div>
        {course.discount_amount > 0 && (
          <div className="flex items-center justify-between p-4 text-sm">
            <span className="text-slate-muted">Discount</span>
            <span className="text-success">-₹{course.discount_amount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex items-center justify-between p-4">
          <span className="text-slate-muted">Final payable amount</span>
          <span className="font-display text-xl text-gold-bright">₹{payment.amount.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="card mt-6 p-6 text-center">
        {upiLink ? (
          <>
            <div className="mx-auto w-fit rounded-card bg-parchment p-3">
              <QRCodeSVG value={upiLink} size={200} />
            </div>
            <p className="mt-4 text-sm text-slate-muted">Scan with any UPI app, or</p>
            <a href={upiLink} className="btn-primary mt-2 inline-flex">Pay with UPI app</a>
            <p className="mt-3 text-xs text-slate-muted">Paying to: {PAYEE_NAME}</p>
          </>
        ) : (
          <p className="text-sm text-danger">
            UPI collection isn&apos;t configured yet (missing VITE_UPI_VPA). Set it in your deployment environment
            before going live — payment cannot proceed without it.
          </p>
        )}
      </div>

      <div className="card mt-6 p-6">
        <label htmlFor="utr" className="text-sm font-medium">
          After paying, enter your UPI transaction reference (UTR)
        </label>
        <input
          id="utr"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="e.g. 302311234567"
          className="mt-2 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          onClick={submitUtr}
          disabled={submitting || !utr.trim()}
          className="btn-primary mt-4 w-full disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit for verification'}
        </button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  )
}