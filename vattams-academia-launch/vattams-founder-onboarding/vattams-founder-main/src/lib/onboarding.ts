import { doc, runTransaction } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

// Onboarding turns an APPROVED tutor/student into an ONBOARDED + ACTIVE
// one, and is the single place a permanent Employee Code / Student Code
// is minted. Both code generation and the status flip happen inside one
// Firestore transaction so the operation is:
//
//   1. Idempotent — clicking "Onboard" twice (or two admins racing) never
//      produces two codes for the same person. If a code already exists
//      on the doc, the transaction just returns it unchanged.
//   2. Race-safe across different people — the running sequence number
//      lives in its own `counters/{counterId}` document. Firestore
//      transactions use optimistic concurrency: if two onboarding calls
//      for two different tutors both read the counter at value N, only
//      one of their commits wins; the loser is automatically retried by
//      the SDK, re-reads the counter (now N+1) and the target doc, and
//      proceeds safely. No two people can ever be assigned the same code.
//
// Counter documents live at counters/tutor_employee_code and
// counters/student_code — new, additive collection, doesn't touch any
// existing data.

const CODE_DIGITS = 5

function formatCode(prefix: 'VA-TUT' | 'VA-STU', sequence: number): string {
  return `${prefix}-${String(sequence).padStart(CODE_DIGITS, '0')}`
}

// Permanent internal identity ID (separate from the human-facing Employee
// / Student Code, and never the Firebase UID). Generated once, stored
// permanently. Uses crypto.getRandomValues (available in all browsers
// this app targets) rather than Math.random for a non-guessable ID.
function generatePermanentId(rolePrefix: 'TID' | 'SID'): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return `VA-${rolePrefix}-${hex}`
}

export interface OnboardResult {
  employeeOrStudentCode: string
  permanentId: string
  alreadyOnboarded: boolean
  error: string | null
}

async function onboard(
  collectionName: 'tutors' | 'students',
  personId: string,
  adminIdentifier: string,
  codePrefix: 'VA-TUT' | 'VA-STU',
  codeField: 'employee_code' | 'student_code',
  idField: 'tutor_id' | 'student_id',
  counterId: 'tutor_employee_code' | 'student_code',
  idRolePrefix: 'TID' | 'SID'
): Promise<OnboardResult> {
  try {
    const personRef = doc(firestore, collectionName, personId)
    const counterRef = doc(firestore, 'counters', counterId)

    const result = await runTransaction(firestore, async (tx) => {
      const personSnap = await tx.get(personRef)
      if (!personSnap.exists()) {
        throw new Error('not-found')
      }
      const data = personSnap.data()

      // Idempotent: an existing code means this person was already
      // onboarded — return it as-is, do not touch the counter, do not
      // regenerate anything, do not require re-approval.
      const existingCode = data[codeField]
      const existingId = data[idField]
      if (typeof existingCode === 'string' && existingCode && typeof existingId === 'string' && existingId) {
        return { code: existingCode, permanentId: existingId, alreadyOnboarded: true }
      }

      // Only an approved application can be onboarded.
      if (data.status !== 'approved') {
        throw new Error('not-approved')
      }

      const counterSnap = await tx.get(counterRef)
      const currentValue = counterSnap.exists() && typeof counterSnap.data().value === 'number'
        ? counterSnap.data().value
        : 0
      const nextValue = currentValue + 1

      const code = formatCode(codePrefix, nextValue)
      const permanentId = generatePermanentId(idRolePrefix)

      tx.set(counterRef, { value: nextValue }, { merge: true })
      tx.update(personRef, {
        [codeField]: code,
        [idField]: permanentId,
        onboarding_status: 'active',
        onboarded_at: new Date().toISOString(),
        onboarded_by: adminIdentifier,
      })

      return { code, permanentId, alreadyOnboarded: false }
    })

    return {
      employeeOrStudentCode: result.code,
      permanentId: result.permanentId,
      alreadyOnboarded: result.alreadyOnboarded,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'not-found') {
      return { employeeOrStudentCode: '', permanentId: '', alreadyOnboarded: false, error: 'Record not found.' }
    }
    if (message === 'not-approved') {
      return {
        employeeOrStudentCode: '',
        permanentId: '',
        alreadyOnboarded: false,
        error: 'Only approved applications can be onboarded. Approve this record first.',
      }
    }
    if (import.meta.env.DEV) console.error(`[onboarding] ${collectionName} onboarding failed:`, error)
    return {
      employeeOrStudentCode: '',
      permanentId: '',
      alreadyOnboarded: false,
      error: 'Something went wrong while onboarding. Please try again.',
    }
  }
}

export function onboardTutor(tutorId: string, adminIdentifier: string) {
  return onboard('tutors', tutorId, adminIdentifier, 'VA-TUT', 'employee_code', 'tutor_id', 'tutor_employee_code', 'TID')
}

export function onboardStudent(studentId: string, adminIdentifier: string) {
  return onboard('students', studentId, adminIdentifier, 'VA-STU', 'student_code', 'student_id', 'student_code', 'SID')
}
