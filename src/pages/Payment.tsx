import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Course, Payment } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'

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
    let cancelled = false

    async function init() {
      setError(null)
      setNotFound(false)

      try {
        const { data: courseData, error: courseErr } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single()
        if (cancelled) return
        if (courseErr) {
          // PGRST116 = no rows for .single() — a genuine "course not
          // found," not a network problem. Anything else (offline,
          // timeout, RLS, etc.) is a connection error and should offer a
          // retry rather than claiming the course doesn't exist.
          if (courseErr.code === 'PGRST116') {
            setNotFound(true)
          } else {
            console.error('Failed to load course for payment:', courseErr)
            setError(CONNECTION_ERROR)
          }
          return
        }
        if (!courseData) {
          setNotFound(true)
          return
        }
        setCourse(courseData as unknown as Course)

        // Reuse an existing pending payment for this student+course if one
        // exists, instead of creating duplicates on every page visit.
        const { data: existing, error: existingErr } = await supabase
          .from('payments')
          .select('*')
          .eq('student_id', user!.id)
          .eq('course_id', courseId)
          .in('status', ['pending', 'submitted'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        if (existingErr) {
          // Don't fall through to creating a new payment when we couldn't
          // even check for an existing one — that's how a transient
          // network blip on this read turns into a duplicate pending
          // payment. Stop here and let the person retry instead.
          console.error('Failed to check for an existing payment:', existingErr)
          setError(CONNECTION_ERROR)
          return
        }

        if (existing) {
          setPayment(existing as unknown as Payment)
          return
        }

        const c = courseData as unknown as Course
        const amount = Math.max(c.base_fee - c.discount_amount, 0)
        const { data: created, error: createErr } = await supabase
          .from('payments')
          .insert({ student_id: user!.id, course_id: courseId, amount, status: 'pending' })
          .select()
          .single()

        if (cancelled) return

        if (createErr) {
          console.error('Failed to create payment record:', createErr)
          setError(CONNECTION_ERROR)
        } else {
          setPayment(created as unknown as Payment)
        }
      } catch (err) {
        // Guards against anything that escapes the supabase-js error
        // objects above (e.g. a raw network exception) leaving this page
        // stuck on "Loading payment details…" forever.
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
      const { error } = await supabase
        .from('payments')
        .update({ utr_reference: utr.trim(), status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', payment.id)
      if (error) {
        console.error('Failed to submit payment reference:', error)
        setError('Unable to submit right now. Please check your connection and try again.')
      } else {
        setPayment({ ...payment, utr_reference: utr.trim(), status: 'submitted' })
      }
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