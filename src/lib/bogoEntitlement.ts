import {
  doc,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

export const BOGO_EXPIRY_ISO = '2026-10-01T23:59:59.999Z'

export interface BogoEntitlement {
  entitlementId: string
  paymentId: string
  studentId: string
  purchasedCourseId: string
  purchasedCourseName: string
  purchasedRegularPrice: number
  eligibleUntil: string
  claimed: boolean
  claimedCourseId?: string
  claimedAt?: unknown
  createdAt?: unknown
}

export function bogoEntitlementRef(entitlementId: string) {
  return doc(
    firestore,
    'bogo_entitlements',
    entitlementId,
  )
}

export function createBogoEntitlementTx(
  tx: Transaction,
  entitlementId: string,
  data: Omit<
    BogoEntitlement,
    'entitlementId' | 'claimed' | 'createdAt'
  >,
) {
  const ref = bogoEntitlementRef(entitlementId)

  tx.set(ref, {
    entitlement_id: entitlementId,
    payment_id: data.paymentId,
    student_id: data.studentId,
    purchased_course_id: data.purchasedCourseId,
    purchased_course_name: data.purchasedCourseName,
    purchased_regular_price: data.purchasedRegularPrice,
    eligible_until: data.eligibleUntil,
    claimed: false,
    created_at: serverTimestamp(),
  })

  return ref
}
