import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

export interface CatalogLaunchEligibility {
  courseKey: string
  courseId: string
  studentId: string
  claimedAt: string
  active: boolean
}

/**
 * Best-effort checkout display check.
 * The authoritative decision is made by claimCatalogLaunchSlotTx()
 * inside the admin payment-approval transaction.
 */
export async function peekCatalogLaunchAvailability(
  courseKey: string,
  maxStudents = 50,
): Promise<boolean> {
  const ref = doc(firestore, 'catalog_launch_counters', courseKey)
  const snap = await getDoc(ref)
  const claimed = snap.exists()
    ? ((snap.data().claimed_count as number) ?? 0)
    : 0

  return claimed < maxStudents
}

function counterRef(courseKey: string) {
  return doc(firestore, 'catalog_launch_counters', courseKey)
}

function eligibilityRef(courseKey: string, studentId: string) {
  return doc(
    firestore,
    'catalog_launch_eligibility',
    `${courseKey}_${studentId}`,
  )
}

/**
 * Authoritative first-N launch-discount claim.
 *
 * Must be called inside the same Firestore transaction that approves
 * the payment and activates the enrolment.
 *
 * The slot is consumed only once for a given student/course.
 */
export async function claimCatalogLaunchSlotTx(
  tx: Transaction,
  courseKey: string,
  courseId: string,
  studentId: string,
  regularPrice: number,
  launchPrice: number,
  maxStudents = 50,
  paymentAmount?: number,
): Promise<CatalogLaunchEligibility> {
  const eRef = eligibilityRef(courseKey, studentId)
  const existingSnap = await tx.get(eRef)

  if (existingSnap.exists()) {
    const existing = existingSnap.data()
    const active = existing.active === true

    const expectedAmount = active ? launchPrice : regularPrice

    if (
      paymentAmount != null &&
      paymentAmount !== expectedAmount
    ) {
      throw new Error(
        active
          ? `This launch-offer payment must be ₹${launchPrice.toLocaleString('en-IN')}.`
          : `The launch offer is no longer available. The payment must be ₹${regularPrice.toLocaleString('en-IN')}.`,
      )
    }

    return {
      courseKey,
      courseId,
      studentId,
      claimedAt:
        (existing.claimed_at as string) ??
        new Date(0).toISOString(),
      active,
    }
  }

  const cRef = counterRef(courseKey)
  const counterSnap = await tx.get(cRef)

  const claimedCount = counterSnap.exists()
    ? ((counterSnap.data().claimed_count as number) ?? 0)
    : 0

  const withinCap = claimedCount < maxStudents

  const expectedAmount = withinCap ? launchPrice : regularPrice

  if (
    paymentAmount != null &&
    paymentAmount !== expectedAmount
  ) {
    throw new Error(
      withinCap
        ? `This launch-offer payment must be ₹${launchPrice.toLocaleString('en-IN')}.`
        : `The first ${maxStudents} launch offers have been claimed. The payment must be ₹${regularPrice.toLocaleString('en-IN')}.`,
    )
  }

  const claimedAt = new Date().toISOString()

  const eligibility: CatalogLaunchEligibility = {
    courseKey,
    courseId,
    studentId,
    claimedAt,
    active: withinCap,
  }

  if (withinCap) {
    tx.set(
      cRef,
      {
        course_key: courseKey,
        claimed_count: increment(1),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    )
  }

  tx.set(eRef, {
    course_key: courseKey,
    course_id: courseId,
    student_id: studentId,
    claimed_at: claimedAt,
    active: withinCap,
    created_at: serverTimestamp(),
  })

  return eligibility
}

export async function claimCatalogLaunchSlot(
  courseKey: string,
  courseId: string,
  studentId: string,
  regularPrice: number,
  launchPrice: number,
  maxStudents = 50,
  paymentAmount?: number,
): Promise<CatalogLaunchEligibility> {
  return runTransaction(firestore, (tx) =>
    claimCatalogLaunchSlotTx(
      tx,
      courseKey,
      courseId,
      studentId,
      regularPrice,
      launchPrice,
      maxStudents,
      paymentAmount,
    ),
  )
}
