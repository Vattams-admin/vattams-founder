// src/pages/TutorPayment.tsx
//
// Tutor equivalent of src/pages/Payment.tsx: same UPI/QR/UTR pattern,
// same configured VPA/payee env vars, but for the fixed ₹500 tutor
// registration fee instead of a course fee. See
// src/lib/tutorPayments.ts for the deterministic-doc-id logic this page
// relies on.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Payment } from '@/types/database'
import { TUTOR_REGISTRATION_FEE, getOrCreateTutorRegistrationPayment, submitTutorRegistrationUtr } from '@/lib/tutorPayments'

const PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME || 'VATTAMS ACADEMIA'
const PAYEE_VPA = import.meta.env.VITE_UPI_VPA as string | undefined

const CONNECTION_ERROR = 'Unable to connect right now. Please check your internet connection and try again.'

export default function TutorPayment() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [payment, setPayment] = useState<Payment | null>(null)
  const [notATutor, setNotATutor] = useState(false)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (loading) return

    if (!user) {
      navigate('/login', { state: { redirectTo: '/tutor/pay' } })
      return
    }
    let cancelled = false

    async function init() {
      setError(null)
      try {
        const tutorSnap = await getDoc(doc(firestore, 'tutors', user!.id))
        if (cancelled) return
        if (!tutorSnap.exists()) {
          setNotATutor(true)
          return
        }
        const tutorData = tutorSnap.data()

        const result = await getOrCreateTutorRegistrationPayment({
          id: user!.id,
          full_name: typeof tutorData.full_name === 'string' ? tutorData.full_name : null,
          email: user!.email ?? null,
        })
        if (cancelled) return
        setPayment(result)
      } catch (err) {
        if (cancelled) return
        console.error('Unexpected error loading tutor payment page:', err)
        setError(CONNECTION_ERROR)
      }
    }

    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, retryToken])

  async function submitUtr() {
    if (!payment || !utr.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await submitTutorRegistrationUtr(payment.id, utr)
      setPayment({ ...payment, utr_reference: utr.trim(), status: 'submitted' })
    } catch (err) {
      console.error('Unexpected error submitting tutor payment reference:', err)
      setError('Unable to submit right now. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (notATutor) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-muted">
        <p className="font-display text-lg text-parchment">No tutor application found</p>
        <p className="mt-2 text-sm">
          This page is only for tutor accounts. If you registered as a student, visit your dashboard instead.
        </p>
      </div>
    )
  }

  if (!payment) {
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

  const upiLink = PAYEE_VPA
    ? `upi://pay?pa=${encodeURIComponent(PAYEE_VPA)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${payment.amount}&cu=INR&tn=${encodeURIComponent(
        'VATTAMS ACADEMIA - Tutor Registration Fee'
      )}`
    : null

  if (payment.status === 'submitted' || payment.status === 'approved') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl">
          {payment.status === 'approved' ? 'Payment verified' : 'Payment submitted'}
        </h1>
        <p className="mt-3 text-slate-muted">
          {payment.status === 'approved' ? (
            'Your ₹500 registration payment has been verified. An admin will review and approve your application next.'
          ) : (
            <>
              We&apos;ve received your reference <span className="text-parchment">{payment.utr_reference}</span>.
              An admin will verify it before your application can be approved.
            </>
          )}
        </p>
      </div>
    )
  }

  if (payment.status === 'rejected') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl text-danger">Payment could not be verified</h1>
        {payment.admin_notes && <p className="mt-3 text-slate-muted">{payment.admin_notes}</p>}
        <p className="mt-3 text-slate-muted">Enter a new UTR below once you&apos;ve made the payment again.</p>
        <div className="card mx-auto mt-6 max-w-sm p-6 text-left">
          <UtrForm utr={utr} setUtr={setUtr} submitting={submitting} onSubmit={submitUtr} error={error} />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">Tutor registration fee</h1>
      <p className="mt-2 text-sm text-slate-muted">
        A one-time ₹{TUTOR_REGISTRATION_FEE} registration fee is required before your tutor application can be
        approved.
      </p>

      <div className="card mt-6 divide-y divide-white/10">
        <div className="flex items-center justify-between p-4">
          <span className="text-slate-muted">Registration fee</span>
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
        <UtrForm utr={utr} setUtr={setUtr} submitting={submitting} onSubmit={submitUtr} error={error} hideLabel />
      </div>
    </div>
  )
}

function UtrForm({
  utr,
  setUtr,
  submitting,
  onSubmit,
  error,
  hideLabel,
}: {
  utr: string
  setUtr: (v: string) => void
  submitting: boolean
  onSubmit: () => void
  error: string | null
  hideLabel?: boolean
}) {
  return (
    <>
      {!hideLabel && <label className="text-sm font-medium">UPI transaction reference (UTR)</label>}
      <input
        id="utr"
        value={utr}
        onChange={(e) => setUtr(e.target.value)}
        placeholder="e.g. 302311234567"
        className="mt-2 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <button
        onClick={onSubmit}
        disabled={submitting || !utr.trim()}
        className="btn-primary mt-4 w-full disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit for verification'}
      </button>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </>
  )
}
