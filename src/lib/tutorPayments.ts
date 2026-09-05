// src/lib/tutorPayments.ts
//
// Tutor ₹500 UPI registration fee — reuses the exact same `payments`
// Firestore collection, status machine (pending -> submitted ->
// approved/rejected), and UTR-submission flow as the existing student
// course-payment implementation (src/pages/Payment.tsx,
// src/pages/admin/AdminPayments.tsx). The only structural difference is
// the doc id: a tutor-registration payment always lives at the
// deterministic id `tutor_registration_{tutorUID}` instead of an
// auto-generated addDoc() id, so:
//   - a tutor can never accidentally create two registration payments,
//   - the Firestore security rules (see firestore.rules) can enforce
//     the ₹500 approval gate on `tutors/{tutorId}` by reading this
//     exact doc path directly, with no query needed,
//   - the onboarding transaction (src/lib/onboarding.ts) can do the
//     same inside a transaction.
//
// This module deliberately does NOT touch `enrolments` — approving a
// tutor-registration payment must never create a student enrolment
// (see decideTutorRegistrationPayment below).

import { doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Payment } from '@/types/database'
import { createNotification, createAdminBroadcast } from '@/lib/notifications'

export const TUTOR_REGISTRATION_FEE = 500

export function tutorRegistrationPaymentId(tutorUid: string): string {
  return `tutor_registration_${tutorUid}`
}

/**
 * Returns the tutor's existing ₹500 registration payment, or creates it
 * (status: 'pending') if this is the tutor's first visit to the payment
 * page. Idempotent — reuses the same deterministic doc on every call,
 * mirroring Payment.tsx's "reuse an existing pending/submitted payment"
 * behavior for course payments.
 */
export async function getOrCreateTutorRegistrationPayment(tutor: {
  id: string
  full_name?: string | null
  email?: string | null
}): Promise<Payment> {
  const paymentRef = doc(firestore, 'payments', tutorRegistrationPaymentId(tutor.id))
  const existing = await getDoc(paymentRef)

  if (existing.exists()) {
    return { id: existing.id, ...existing.data() } as Payment
  }

  const newPayment = {
    payment_type: 'tutor_registration' as const,
    tutor_id: tutor.id,
    tutor_name: tutor.full_name ?? tutor.email ?? null,
    // Left null (not omitted) so the doc shape matches the existing
    // Payment type exactly — every reader that does payment.student_id
    // already has to handle null/undefined post this change.
    student_id: null,
    course_id: null,
    course_name: null,
    student_name: null,
    amount: TUTOR_REGISTRATION_FEE,
    status: 'pending' as const,
    utr_reference: null,
    submitted_at: null,
    verified_at: null,
    verified_by: null,
    admin_notes: null,
    created_at: new Date().toISOString(),
  }

  await setDoc(paymentRef, newPayment)
  return { id: paymentRef.id, ...newPayment }
}

export async function submitTutorRegistrationUtr(paymentId: string, utr: string): Promise<void> {
  await updateDoc(doc(firestore, 'payments', paymentId), {
    utr_reference: utr.trim(),
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  })

  void createAdminBroadcast({
    type: 'payment_received',
    title: 'Tutor registration payment awaiting verification',
    message: `A tutor submitted a UTR for the ₹${TUTOR_REGISTRATION_FEE} registration fee.`,
    related_id: paymentId,
    related_type: 'payment',
    action_url: '/admin/tutors',
  })
}

export interface DecideTutorPaymentResult {
  alreadyProcessed: boolean
  error: string | null
}

/**
 * Admin approve/reject for a tutor-registration payment. Deliberately
 * has no enrolment-creation branch (unlike AdminPayments.tsx's course
 * decide()) — a tutor-registration payment is never associated with a
 * course, so there is nothing to enrol.
 */
export async function decideTutorRegistrationPayment(
  payment: Payment,
  status: 'approved' | 'rejected',
  adminIdentifier: string,
  note: string | null
): Promise<DecideTutorPaymentResult> {
  try {
    const paymentRef = doc(firestore, 'payments', payment.id)

    const result = await runTransaction(firestore, async (tx) => {
      const freshSnap = await tx.get(paymentRef)
      if (!freshSnap.exists()) {
        throw new Error('This payment no longer exists.')
      }
      // Idempotency guard, same shape as AdminPayments.tsx's course
      // decide() — a second admin tab / double-click is a no-op.
      if (freshSnap.data().status !== 'submitted') {
        return { alreadyProcessed: true }
      }

      tx.update(paymentRef, {
        status,
        verified_at: new Date().toISOString(),
        verified_by: adminIdentifier,
        admin_notes: note,
      })

      return { alreadyProcessed: false }
    })

    if (result.alreadyProcessed) {
      return { alreadyProcessed: true, error: null }
    }

    if (payment.tutor_id) {
      void createNotification({
        recipient_uid: payment.tutor_id,
        recipient_role: 'tutor',
        type: 'tutor_payment_status',
        title: status === 'approved' ? 'Registration payment verified' : 'Registration payment could not be verified',
        message:
          status === 'approved'
            ? `Your ₹${TUTOR_REGISTRATION_FEE} registration payment has been verified. An admin can now approve your tutor application.`
            : note
              ? `Your ₹${TUTOR_REGISTRATION_FEE} registration payment was rejected: ${note}`
              : `Your ₹${TUTOR_REGISTRATION_FEE} registration payment could not be verified. Please check your reference and try again.`,
        related_id: payment.id,
        related_type: 'payment',
        action_url: '/tutor/pay',
      })
    }

    return { alreadyProcessed: false, error: null }
  } catch (error) {
    console.error('Failed to decide tutor registration payment:', error)
    return { alreadyProcessed: false, error: 'Unable to save this decision right now. Please check your connection and try again.' }
  }
}

/** Read-only lookup used by TutorDashboard / AdminTutors to show status. */
export async function getTutorRegistrationPayment(tutorId: string): Promise<Payment | null> {
  const snap = await getDoc(doc(firestore, 'payments', tutorRegistrationPaymentId(tutorId)))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Payment
}
