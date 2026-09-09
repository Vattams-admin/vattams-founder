import {
  doc,
  getDoc,
  runTransaction,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'

const COUNTER_ID = 'launch'
const COUNTER_COLLECTION = 'school_tuition_counters'
const ELIGIBILITY_COLLECTION = 'school_tuition_eligibility'

export interface SchoolTuitionEligibility {
  student_id: string
  course_id: string
  plan_key: string
  claimed_at: string
  months_granted: number
  months_used: number
  active: boolean
}

function counterRef(db: Firestore) {
  return doc(db, COUNTER_COLLECTION, COUNTER_ID)
}

function eligibilityRef(db: Firestore, studentId: string) {
  return doc(db, ELIGIBILITY_COLLECTION, studentId)
}

export async function peekSchoolTuitionLaunchAvailability(
  db: Firestore,
  maxStudents: number,
): Promise<boolean> {
  const snap = await getDoc(counterRef(db))
  if (!snap.exists()) return true

  const claimedCount = snap.data().claimed_count ?? 0
  return claimedCount < maxStudents
}

export async function getSchoolTuitionEligibility(
  db: Firestore,
  studentId: string,
): Promise<SchoolTuitionEligibility | null> {
  const snap = await getDoc(eligibilityRef(db, studentId))
  if (!snap.exists()) return null

  return snap.data() as SchoolTuitionEligibility
}

export async function claimSchoolTuitionSlotTx(
  tx: Transaction,
  db: Firestore,
  params: {
    studentId: string
    courseId: string
    planKey: string
    launchPrice: number
    regularPrice: number
    launchMaxStudents: number
    launchDurationMonths: number
    paymentAmount: number
  },
): Promise<{ launchGranted: boolean; monthsUsed: number }> {
  const counter = await tx.get(counterRef(db))
  const eligibility = await tx.get(eligibilityRef(db, params.studentId))

  if (eligibility.exists()) {
    const existing = eligibility.data() as SchoolTuitionEligibility

    if (
      existing.active &&
      existing.course_id === params.courseId &&
      existing.plan_key === params.planKey
    ) {
      return {
        launchGranted: true,
        monthsUsed: existing.months_used,
      }
    }

    if (
      params.paymentAmount !== params.regularPrice &&
      params.paymentAmount !== params.launchPrice
    ) {
      throw new Error('Invalid school tuition payment amount.')
    }

    return {
      launchGranted: false,
      monthsUsed: 0,
    }
  }

  const claimedCount = counter.exists()
    ? Number(counter.data().claimed_count ?? 0)
    : 0

  const launchAvailable = claimedCount < params.launchMaxStudents

  if (launchAvailable) {
    if (params.paymentAmount !== params.launchPrice) {
      throw new Error(
        'The school tuition launch offer is currently available, so this payment must use the launch price.',
      )
    }

    tx.set(
      counterRef(db),
      {
        claimed_count: claimedCount + 1,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    )

    tx.set(eligibilityRef(db, params.studentId), {
      student_id: params.studentId,
      course_id: params.courseId,
      plan_key: params.planKey,
      claimed_at: new Date().toISOString(),
      months_granted: params.launchDurationMonths,
      months_used: 1,
      active: true,
    })

    return {
      launchGranted: true,
      monthsUsed: 1,
    }
  }

  if (params.paymentAmount !== params.regularPrice) {
    throw new Error(
      'The school tuition launch offer has reached its first-student limit.',
    )
  }

  return {
    launchGranted: false,
    monthsUsed: 0,
  }
}

export async function consumeSchoolTuitionMonthTx(
  tx: Transaction,
  db: Firestore,
  params: {
    studentId: string
    courseId: string
    planKey: string
    launchPrice: number
    regularPrice: number
    paymentAmount: number
  },
): Promise<{ launchActive: boolean; monthsUsed: number }> {
  const eligibilitySnap = await tx.get(
    eligibilityRef(db, params.studentId),
  )

  if (!eligibilitySnap.exists()) {
    if (params.paymentAmount !== params.regularPrice) {
      throw new Error('School tuition launch eligibility was not found.')
    }

    return {
      launchActive: false,
      monthsUsed: 0,
    }
  }

  const eligibility = eligibilitySnap.data() as SchoolTuitionEligibility

  if (
    eligibility.course_id !== params.courseId ||
    eligibility.plan_key !== params.planKey
  ) {
    throw new Error('School tuition plan does not match the original launch plan.')
  }

  const launchStillActive =
    eligibility.active &&
    eligibility.months_used < eligibility.months_granted

  if (launchStillActive) {
    if (params.paymentAmount !== params.launchPrice) {
      throw new Error(
        'This school tuition student is still within the launch period and must use the launch price.',
      )
    }

    const nextMonthsUsed = eligibility.months_used + 1
    const stillActive = nextMonthsUsed < eligibility.months_granted

    tx.update(eligibilityRef(db, params.studentId), {
      months_used: nextMonthsUsed,
      active: stillActive,
    })

    return {
      launchActive: true,
      monthsUsed: nextMonthsUsed,
    }
  }

  if (params.paymentAmount !== params.regularPrice) {
    throw new Error(
      'The school tuition launch period has ended; the regular price is required.',
    )
  }

  return {
    launchActive: false,
    monthsUsed: eligibility.months_used,
  }
}

export async function claimSchoolTuitionSlot(
  db: Firestore,
  params: Parameters<typeof claimSchoolTuitionSlotTx>[2],
) {
  return runTransaction(db, (tx) =>
    claimSchoolTuitionSlotTx(tx, db, params),
  )
}
