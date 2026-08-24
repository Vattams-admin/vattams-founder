// Types for the NEW Supabase tables introduced in Phase 2:
//   public.academy_students
//   public.academy_tutors
//
// ASSUMPTION FLAG — READ BEFORE TRUSTING THESE TYPES:
// These tables were created directly in Supabase (outside this repo — no
// migration file for them exists in supabase/migrations/), so their real
// column names could not be inspected from the codebase. The fields below
// are the best-guess snake_case columns implied by the field list in the
// Phase 2 spec. Every admin list page in this phase reads with
// `select('*')` (never a named column list) specifically so a wrong guess
// here does not break the read path — only the labeled display and the
// write paths (insert on registration, update on approve/reject) depend
// on these exact names. See the Phase 2 final report for the full list of
// assumed column names to verify against the actual schema.

export type AcademyApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AcademyPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type AcademyTutorStatus = 'pending_approval' | 'approved' | 'rejected'
export type AcademyStudentStatus = 'active' | 'inactive' | 'pending' | string

export interface AcademyStudent {
  id: string
  firebase_uid: string
  full_name: string
  email: string | null
  phone: string | null
  class: string | null
  school: string | null
  parent_name: string | null
  parent_phone: string | null
  city: string | null
  status: AcademyStudentStatus | null
  created_at: string
}

export interface AcademyTutor {
  id: string
  firebase_uid: string
  full_name: string
  email: string | null
  phone: string | null
  city: string | null
  qualification: string | null
  experience: string | null
  teaching_mode: string | null
  subjects: string[] | string | null
  availability: string | null
  payment_status: AcademyPaymentStatus | null
  approval_status: AcademyApprovalStatus | null
  status: AcademyTutorStatus | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  created_at: string
}
