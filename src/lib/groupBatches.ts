// src/lib/groupBatches.ts
//
// Enforces the "Karthi Tutor group session = 4 students per batch"
// rule server-side (via Firestore transaction semantics), not by
// counting rows on the client. A batch is a fixed group of up to
// `batchSize` students for one course; once a batch is full, the next
// student is placed into a new batch instead of overfilling it.
//
// Collections (all admin-write-only — see firestore.rules):
//   course_batches/{courseId}_{batchNumber}        { course_id, batch_number, capacity, member_count, status }
//   course_batch_pointers/{courseId}                { course_id, latest_batch_number }
//   course_batch_members/{courseId}_{studentId}     { course_id, student_id, batch_number, status }
//
// Every *_Tx function takes an in-progress Firestore `Transaction` and
// performs ONLY reads-then-writes against it (no nested transaction),
// so a caller (see AdminPayments.tsx) can compose this with other
// changes — payment status, enrolment activation, revenue-split
// recording — into a single atomic commit. Standalone wrappers
// (assignStudentToBatch / releaseStudentFromBatch) exist for callers
// that just need this in isolation.

import { doc, runTransaction, serverTimestamp, type Transaction } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

export interface BatchAssignment {
  batchNumber: number
  batchId: string
}

function batchDocRef(courseId: string, batchNumber: number) {
  return doc(firestore, 'course_batches', `${courseId}_${batchNumber}`)
}
function pointerDocRef(courseId: string) {
  return doc(firestore, 'course_batch_pointers', courseId)
}
function memberDocRef(courseId: string, studentId: string) {
  return doc(firestore, 'course_batch_members', `${courseId}_${studentId}`)
}

/**
 * Idempotent: a student who already has an ACTIVE batch membership for
 * this course (e.g. this is their 2nd/3rd monthly renewal payment)
 * gets their existing batch back — no new slot is consumed. Only a
 * student with no membership, or a previously-released one, consumes
 * a new slot, opening a new batch if the current one is already at
 * `batchSize`.
 */
export async function assignStudentToBatchTx(
  tx: Transaction,
  courseId: string,
  studentId: string,
  batchSize: number
): Promise<BatchAssignment> {
  const memberRef = memberDocRef(courseId, studentId)
  const memberSnap = await tx.get(memberRef)
  if (memberSnap.exists() && memberSnap.data().status === 'active') {
    const existingBatchNumber = memberSnap.data().batch_number as number
    return { batchNumber: existingBatchNumber, batchId: `${courseId}_${existingBatchNumber}` }
  }

  const pointerRef = pointerDocRef(courseId)
  const pointerSnap = await tx.get(pointerRef)
  let batchNumber = pointerSnap.exists() ? (pointerSnap.data().latest_batch_number as number) : 1
  let batchRef = batchDocRef(courseId, batchNumber)
  let batchSnap = await tx.get(batchRef)

  // If the current "latest" batch is already at capacity, read the
  // next one instead — still a read, still happens before any writes
  // below, so this stays a valid Firestore transaction (all gets
  // before all sets/updates).
  if (batchSnap.exists()) {
    const capacity = (batchSnap.data().capacity as number) ?? batchSize
    const memberCount = batchSnap.data().member_count as number
    if (memberCount >= capacity) {
      batchNumber += 1
      batchRef = batchDocRef(courseId, batchNumber)
      batchSnap = await tx.get(batchRef)
    }
  }

  if (!batchSnap.exists()) {
    tx.set(batchRef, {
      course_id: courseId,
      batch_number: batchNumber,
      capacity: batchSize,
      member_count: 1,
      status: batchSize <= 1 ? 'full' : 'open',
      created_at: serverTimestamp(),
    })
  } else {
    const memberCount = (batchSnap.data().member_count as number) + 1
    const capacity = (batchSnap.data().capacity as number) ?? batchSize
    tx.update(batchRef, {
      member_count: memberCount,
      status: memberCount >= capacity ? 'full' : 'open',
    })
  }

  tx.set(pointerRef, { course_id: courseId, latest_batch_number: batchNumber }, { merge: true })
  tx.set(
    memberRef,
    {
      course_id: courseId,
      student_id: studentId,
      batch_number: batchNumber,
      status: 'active',
      assigned_at: serverTimestamp(),
    },
    { merge: true }
  )

  return { batchNumber, batchId: `${courseId}_${batchNumber}` }
}

export async function assignStudentToBatch(courseId: string, studentId: string, batchSize: number): Promise<BatchAssignment> {
  return runTransaction(firestore, (tx) => assignStudentToBatchTx(tx, courseId, studentId, batchSize))
}

/**
 * Frees a student's batch slot. Not wired to any UI action yet — this
 * app has no "revoke enrolment" feature at all today (checked: neither
 * AdminStudents.tsx nor AdminPayments.tsx has one; Enrolment.status
 * already models 'revoked' but nothing ever sets it). Exported so the
 * next admin who builds that feature has the correct, race-safe
 * release function ready to call instead of hand-rolling one.
 */
export async function releaseStudentFromBatchTx(tx: Transaction, courseId: string, studentId: string): Promise<void> {
  const memberRef = memberDocRef(courseId, studentId)
  const memberSnap = await tx.get(memberRef)
  if (!memberSnap.exists() || memberSnap.data().status !== 'active') return

  const batchNumber = memberSnap.data().batch_number as number
  const batchRef = batchDocRef(courseId, batchNumber)
  const batchSnap = await tx.get(batchRef)

  if (batchSnap.exists()) {
    const memberCount = Math.max((batchSnap.data().member_count as number) - 1, 0)
    tx.update(batchRef, { member_count: memberCount, status: 'open' })
  }
  tx.update(memberRef, { status: 'revoked', revoked_at: serverTimestamp() })
}

export async function releaseStudentFromBatch(courseId: string, studentId: string): Promise<void> {
  return runTransaction(firestore, (tx) => releaseStudentFromBatchTx(tx, courseId, studentId))
}
