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
import { getPricingConfig } from '@/lib/pricingConfig'
import { getEffectiveCoursePricing, resolveEffectivePricingMode, describePricing, type EffectiveCoursePricing } from '@/lib/coursePricing'
import { getOfferEligibility, peekOfferAvailability, markFreeCompetitionEntryUsed } from '@/lib/specialOfferEligibility'

const PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME || 'VATTAMS ACADEMIA'
const PAYEE_VPA = import.meta.env.VITE_UPI_VPA as string | undefined

const CONNECTION_ERROR = 'Unable to connect right now. Please check your internet connection and try again.'

export default function Payment() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [pricing, setPricing] = useState<EffectiveCoursePricing | null>(null)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (authLoading) return

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
      let debugStage = 'starting'
      setError(null)
      setNotFound(false)

      try {
        // `courseId` is the Firestore document id — same as CourseDetail.tsx
        // (`{ id: docSnap.id, ...docSnap.data() }`), so a direct doc get
        // is enough; no query needed like the slug-based pages.
        debugStage = 'course read'
      const courseSnap = await getDoc(doc(firestore, 'courses', courseId as string))
        if (cancelled) return

        if (!courseSnap.exists()) {
          setNotFound(true)
          return
        }
        const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course
        setCourse(courseData)

        // Effective price under the approved commercial model — see
        // src/lib/coursePricing.ts. This replaces the old
        // "always base_fee - discount_amount" assumption; most existing
        // courses now resolve to the monthly group price automatically.
        debugStage = 'pricing config read'
      const pricingConfig = await getPricingConfig()
        const mode = resolveEffectivePricingMode(courseData)

        let specialOfferEligible = true
        if (mode === 'special_offer') {
          const offerKey = courseData.special_offer_key ?? 'phonics'
          const offerConfig =
            offerKey === 'english_abacus' ? pricingConfig.specialOffers.englishAbacus : pricingConfig.specialOffers.phonics
          // If this student already has an enrolment (renewal visit),
          // their real eligibility record is authoritative for display.
          // Otherwise this is a best-effort "are slots still open" read
          // — the actual claim/enforcement happens at admin-approval
          // time (src/lib/specialOfferEligibility.ts), never here.
          const existingElig = await getOfferEligibility(offerKey, user!.id)
          specialOfferEligible = existingElig ? existingElig.active : await peekOfferAvailability(offerKey, offerConfig.offerMaxStudents)
        }

        let effectivePricing = getEffectiveCoursePricing(courseData, pricingConfig, { specialOfferEligible })

        // Phonics "free entry fee for upcoming VATTAMS competitions" —
        // a one-time waiver for competition entry, tracked on the
        // student's Phonics eligibility record so it can only be used
        // once. Only relevant for VATTAMS Competition entries
        // (is_competition courses), which otherwise keep their normal
        // one-time entry-fee price untouched.
        let usingFreeCompetitionEntry = false
        if (effectivePricing.mode === 'competition_entry') {
          debugStage = 'phonics eligibility read'
      const phonicsElig = await getOfferEligibility('phonics', user!.id)
          if (phonicsElig?.freeCompetitionEntry && !phonicsElig.freeCompetitionEntryUsed) {
            usingFreeCompetitionEntry = true
            effectivePricing = { ...effectivePricing, amount: 0, regularAmount: effectivePricing.amount }
          }
        }

        if (cancelled) return
        setPricing(effectivePricing)

        // Reuse an existing pending/submitted payment instead of creating
        // duplicates on every visit. For a one-time charge (legacy /
        // competition_entry / free) this dedups across all time, same as
        // before. For a recurring monthly charge it's scoped to THIS
        // billing period only — a new month is a genuinely new charge,
        // not a duplicate — so a past approved/rejected payment from an
        // earlier month never blocks this month's payment page from
        // working. Requires a composite index on
        // (student_id, course_id, status, created_at) for the one-time
        // shape, and additionally billing_period for the recurring
        // shape — Firestore will show a console link to create whichever
        // is missing the first time each query runs.
        const baseConstraints = [
          where('student_id', '==', user!.id),
          where('course_id', '==', courseId),
          where('status', 'in', ['pending', 'submitted']),
        ]
        const existingQuery = effectivePricing.isRecurring
          ? query(
              collection(firestore, 'payments'),
              ...baseConstraints,
              where('billing_period', '==', effectivePricing.billingPeriod),
              orderBy('created_at', 'desc'),
              limit(1)
            )
          : query(collection(firestore, 'payments'), ...baseConstraints, orderBy('created_at', 'desc'), limit(1))
        debugStage = 'existing payment query'
      const existingSnapshot = await getDocs(existingQuery)
        if (cancelled) return

        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0]
          setPayment({ id: existingDoc.id, ...existingDoc.data() } as Payment)
          return
        }

        const newPayment = {
          student_id: user!.id,
          course_id: courseId,
          // Denormalized so payment lists (admin + student dashboard) can
          // render without a join — Firestore has none.
          course_name: courseData.name,
          student_name: user!.displayName ?? user!.email ?? null,
          amount: effectivePricing.amount,
          status: 'pending' as const,
          utr_reference: null,
          submitted_at: null,
          verified_at: null,
          verified_by: null,
          admin_notes: null,
          created_at: new Date().toISOString(),
          pricing_mode_snapshot: effectivePricing.mode,
          billing_period: effectivePricing.billingPeriod,
          offer_key: effectivePricing.offerKey,
          batch_number: null,
          revenue_split: null
        }
        debugStage = `payment create | uid=${newPayment.student_id} | course=${newPayment.course_id} | amount=${newPayment.amount} | mode=${newPayment.pricing_mode_snapshot}`
      const createdRef = await addDoc(collection(firestore, 'payments'), newPayment)
        if (cancelled) return
        setPayment({ id: createdRef.id, ...newPayment } as Payment)

        // Consume the one-time free-entry waiver only once the ₹0
        // payment doc genuinely exists — never optimistically before
        // the write succeeds.
        if (usingFreeCompetitionEntry) {
          void markFreeCompetitionEntryUsed('phonics', user!.id)
        }
      } catch (err) {
        // Guards against anything that escapes the Firestore calls above
        // leaving this page stuck on "Loading payment details…" forever.
        if (cancelled) return
        console.error('Unexpected error loading payment page:', err)
        const firebaseError = err as { code?: string; message?: string }
      setError(
        firebaseError.code || firebaseError.message
          ? `DEBUG: ${debugStage} → ${firebaseError.code ?? 'unknown'} — ${firebaseError.message ?? 'No message'}`
          : CONNECTION_ERROR
      )
      }
    }

    init()
    return () => { cancelled = true }
  }, [authLoading, courseId, user, retryToken, navigate])

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

  if (!course || !payment || !pricing) {
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
          <span className="text-slate-muted">Plan</span>
          <span>{describePricing(pricing)}</span>
        </div>
          {pricing.mode === 'legacy' && (
            <>
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
            </>
          )}
          {pricing.mode === 'competition_entry' && pricing.regularAmount != null && pricing.regularAmount !== pricing.amount && (
            <div className="flex items-center justify-between p-4 text-sm">
              <span className="text-slate-muted">Regular price</span>
              <span className="line-through text-slate-muted">₹{pricing.regularAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
        {pricing.isRecurring && (
          <div className="flex items-center justify-between p-4 text-sm">
            <span className="text-slate-muted">Billing period</span>
            <span>{pricing.billingPeriod}</span>
          </div>
        )}
        {pricing.mode === 'special_offer' && pricing.regularAmount != null && pricing.regularAmount !== pricing.amount && (
          <div className="flex items-center justify-between p-4 text-sm">
            <span className="text-slate-muted">Regular price</span>
            <span className="line-through text-slate-muted">₹{pricing.regularAmount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="flex items-center justify-between p-4">
          <span className="text-slate-muted">{pricing.isRecurring ? 'This month\u2019s payable amount' : 'Final payable amount'}</span>
          <span className="font-display text-xl text-gold-bright">₹{payment.amount.toLocaleString('en-IN')}</span>
        </div>
      </div>
      {pricing.isRecurring && (
        <p className="mt-2 text-xs text-slate-muted">
          This is a monthly plan. You&apos;ll return to this page next month to submit the next payment — VATTAMS does not
          charge your card/UPI automatically.
        </p>
      )}

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