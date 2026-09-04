import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { AcademyStudent, AcademyTutor } from '@/types/academy'

// Reads the `students` and `tutors` Firestore collections directly —
// these are the same collections StudentRegister.tsx / TutorRegister.tsx
// write to via setDoc(doc(firestore, 'students' | 'tutors', uid), ...).
// There is no separate Supabase mirror: Firestore is the single source
// of truth for academy registrations, so the admin panel reads from the
// same place registrations are written.

export interface AcademyListResult<T> {
  rows: T[]
  error: string | null
}

function friendlyFirestoreError(error: unknown, context: string): string | null {
  if (!error) return null

  if (import.meta.env.DEV) {
    console.error(`[academyAdmin] ${context}:`, error)
  }

  const code = (error as { code?: string })?.code

  // Firestore security rules blocking the read surfaces as
  // 'permission-denied'.
  if (code === 'permission-denied') {
    return `You don't have permission to view ${context}. Check that your admin account has an active Firebase session and a matching Firestore security rule.`
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return `Network error while loading ${context}. Check your connection and try again.`
  }

  return `Something went wrong loading ${context}. Please try again.`
}

function toIsoString(value: unknown): string {
  if (typeof value === 'string') return value
  // Firestore Timestamp objects expose toDate().
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return ''
}

export async function listAcademyStudents(): Promise<AcademyListResult<AcademyStudent>> {
  try {
    const snapshot = await getDocs(query(collection(firestore, 'students'), orderBy('created_at', 'desc')))
    const rows: AcademyStudent[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        full_name: typeof data.full_name === 'string' ? data.full_name : '',
        email: typeof data.email === 'string' ? data.email : null,
        role: typeof data.role === 'string' ? data.role : null,
        status: typeof data.status === 'string' ? data.status : null,
        student_code: typeof data.student_code === 'string' ? data.student_code : null,
        student_id: typeof data.student_id === 'string' ? data.student_id : null,
        onboarding_status: typeof data.onboarding_status === 'string' ? data.onboarding_status : null,
        onboarded_at: typeof data.onboarded_at === 'string' ? data.onboarded_at : null,
        onboarded_by: typeof data.onboarded_by === 'string' ? data.onboarded_by : null,
        created_at: toIsoString(data.created_at),
      }
    })
    return { rows, error: null }
  } catch (error) {
    return { rows: [], error: friendlyFirestoreError(error, 'students') }
  }
}

/**
 * Approves a pending student. Onboarding remains a separate explicit
 * admin action because onboarding generates the permanent student code/ID.
 */
export async function approveAcademyStudent(studentId: string, adminIdentifier: string) {
  try {
    await updateDoc(doc(firestore, 'students', studentId), {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminIdentifier,
    })
    return { error: null }
  } catch (error) {
    return { error: friendlyFirestoreError(error, 'student approval') }
  }
}

export async function listAcademyTutors(): Promise<AcademyListResult<AcademyTutor>> {
  try {
    const snapshot = await getDocs(query(collection(firestore, 'tutors'), orderBy('created_at', 'desc')))
    const rows: AcademyTutor[] = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        full_name: typeof data.full_name === 'string' ? data.full_name : '',
        email: typeof data.email === 'string' ? data.email : null,
        qualification: typeof data.qualification === 'string' ? data.qualification : null,
        expertise: typeof data.expertise === 'string' ? data.expertise : null,
        introduction: typeof data.introduction === 'string' ? data.introduction : null,
        role: typeof data.role === 'string' ? data.role : null,
        status: typeof data.status === 'string' ? data.status : null,
        approved_at: typeof data.approved_at === 'string' ? data.approved_at : null,
        approved_by: typeof data.approved_by === 'string' ? data.approved_by : null,
        rejected_at: typeof data.rejected_at === 'string' ? data.rejected_at : null,
        rejected_by: typeof data.rejected_by === 'string' ? data.rejected_by : null,
        rejection_reason: typeof data.rejection_reason === 'string' ? data.rejection_reason : null,
        created_at: toIsoString(data.created_at),
      }
    })
    return { rows, error: null }
  } catch (error) {
    return { rows: [], error: friendlyFirestoreError(error, 'tutors') }
  }
}

/**
 * Approves a pending tutor by updating their Firestore document's
 * `status` field. `adminIdentifier` is the signed-in admin's email
 * (falls back to uid), used for the `approved_by` audit field.
 */
export async function approveAcademyTutor(tutorId: string, adminIdentifier: string) {
  try {
    await updateDoc(doc(firestore, 'tutors', tutorId), {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminIdentifier,
    })
    return { error: null }
  } catch (error) {
    return { error: friendlyFirestoreError(error, 'tutor approval') }
  }
}

export async function rejectAcademyTutor(tutorId: string, adminIdentifier: string, reason: string) {
  try {
    await updateDoc(doc(firestore, 'tutors', tutorId), {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: adminIdentifier,
      rejection_reason: reason,
    })
    return { error: null }
  } catch (error) {
    return { error: friendlyFirestoreError(error, 'tutor rejection') }
  }
}