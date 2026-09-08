// src/lib/tutorEarnings.ts
//
// Connects the 40/10/30/15/5 revenue split to an actual per-tutor
// ledger, keyed off Course.instructor_tutor_id (new, additive field —
// see src/types/database.ts). Without a tutor_id on the course there
// is nothing to route a payout to, so a course with no assigned tutor
// simply gets no tutor_earnings record (its split is still computed
// and stored on the payment itself either way — see AdminPayments.tsx).
//
// This module deliberately does NOT move money — same as the existing
// ₹500 tutor-registration flow, it only records what a tutor is owed.
// Actually paying a tutor (bank transfer, UPI, etc.) still happens
// outside the app, same as today.
//
// Collection: tutor_earnings/{paymentId} — doc id is the SOURCE
// payment's id, which makes recording idempotent for free: re-running
// the (already-guarded) approval transaction on an already-approved
// payment can never create a second earnings record for the same
// payment.

import { collection, doc, getDocs, query, where, type Transaction } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { RevenueSplit } from '@/lib/pricingModel'
import type { EffectivePricingMode } from '@/lib/coursePricing'

export interface TutorEarning {
  id: string
  tutor_id: string
  tutor_name: string | null
  course_id: string
  course_name: string | null
  payment_id: string
  student_id: string
  amount: number
  pricing_mode: EffectivePricingMode
  billing_period: string | null
  created_at: string
}

function earningRef(paymentId: string) {
  return doc(firestore, 'tutor_earnings', paymentId)
}

/** Call inside the same transaction as the payment-approval write (see AdminPayments.tsx). No-op if the course has no assigned tutor. */
export function recordTutorEarningTx(
  tx: Transaction,
  args: {
    paymentId: string
    tutorId: string | null | undefined
    tutorName: string | null
    courseId: string
    courseName: string | null
    studentId: string
    split: RevenueSplit
    mode: EffectivePricingMode
    billingPeriod: string | null
  }
): void {
  if (!args.tutorId) return
  tx.set(earningRef(args.paymentId), {
    tutor_id: args.tutorId,
    tutor_name: args.tutorName,
    course_id: args.courseId,
    course_name: args.courseName,
    payment_id: args.paymentId,
    student_id: args.studentId,
    amount: args.split.tutor,
    pricing_mode: args.mode,
    billing_period: args.billingPeriod,
    created_at: new Date().toISOString(),
  })
}

/** Sum of all recorded earnings for a tutor — used by AdminTutors.tsx to show accrued (not yet necessarily paid out) totals. */
export async function sumTutorEarnings(tutorId: string): Promise<{ total: number; count: number }> {
  const snap = await getDocs(query(collection(firestore, 'tutor_earnings'), where('tutor_id', '==', tutorId)))
  let total = 0
  snap.forEach((d) => {
    total += (d.data().amount as number) ?? 0
  })
  return { total, count: snap.size }
}
