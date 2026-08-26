// Types for the Firestore `students` and `tutors` collections.
//
// These collections are written by StudentRegister.tsx / TutorRegister.tsx
// via setDoc(doc(firestore, 'students' | 'tutors', user.uid), {...}) and
// read by src/lib/academyAdmin.ts. The fields below reflect exactly what
// those two paths actually read and write — not a guessed Supabase schema.
// Firestore documents are schemaless, so a handful of fields that other
// admin screens (e.g. AdminCertificates.tsx) optionally populate on
// ad-hoc, partial reads are kept as optional rather than required, since
// not every read path fetches every field.

export type AcademyApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AcademyPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type AcademyTutorStatus = 'pending_approval' | 'approved' | 'rejected' | string
export type AcademyStudentStatus = 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | string

// Onboarding is tracked separately from approval status (`status` above).
// A record can be 'approved' but not yet onboarded (no code assigned
// yet); once an admin clicks Onboard, onboarding_status flips straight
// to 'active' and employee_code/tutor_id (or student_code/student_id)
// are permanently assigned — see src/lib/onboarding.ts.
export type AcademyOnboardingStatus = 'not_onboarded' | 'active'

export interface AcademyStudent {
  id: string
  firebase_uid?: string | null
  full_name: string
  email: string | null
  role?: string | null
  status: AcademyStudentStatus | null
  created_at: string
  phone?: string | null
  class?: string | null
  school?: string | null
  parent_name?: string | null
  parent_phone?: string | null
  city?: string | null
  approved_at?: string | null
  approved_by?: string | null
  rejected_at?: string | null
  rejected_by?: string | null
  rejection_reason?: string | null
  student_code?: string | null
  student_id?: string | null
  onboarding_status?: AcademyOnboardingStatus | null
  onboarded_at?: string | null
  onboarded_by?: string | null
}

export interface AcademyTutor {
  id: string
  firebase_uid?: string | null
  full_name: string
  email: string | null
  qualification: string | null
  expertise: string | null
  introduction: string | null
  role?: string | null
  status: AcademyTutorStatus | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  created_at: string
  phone?: string | null
  city?: string | null
  experience?: string | null
  teaching_mode?: string | null
  subjects?: string[] | string | null
  availability?: string | null
  payment_status?: AcademyPaymentStatus | null
  approval_status?: AcademyApprovalStatus | null
  employee_code?: string | null
  tutor_id?: string | null
  onboarding_status?: AcademyOnboardingStatus | null
  onboarded_at?: string | null
  onboarded_by?: string | null
}