// Firestore-backed types for the whole app (courses, payments,
// enrolments, certificates). Field names match the collections already
// read by the public site (Courses.tsx, CourseDetail.tsx, Home.tsx,
// CourseLearn.tsx) — those pages moved to Firestore first, and this
// migration brings the admin panel, payments, and student dashboard in
// line with the same collections instead of a separate Supabase schema.

export interface Course {
  id: string
  // Historically always null — no admin UI ever set this until the
  // catalog seed (see src/lib/catalog.ts). Kept as a plain string (not a
  // foreign key) because there is no separate Firestore `categories`
  // collection in this project; CATALOG_CATEGORIES in src/lib/catalog.ts
  // is the single source of truth for the three known slugs, but the
  // field stays a loose string so older/unrelated rows never fail to type.
  category_id: string | null
  name: string
  slug: string
  subject?: string | null
  short_description: string | null
  description: string | null
  level: 'beginner' | 'intermediate' | 'advanced' | 'professional' | null
  duration_text: string | null
  instructor_name: string | null
  cover_image_url: string | null
  preview_video_url: string | null
  base_fee: number
  discount_amount: number
  is_free: boolean
  is_published: boolean
  is_featured: boolean
  // New, additive field (default/absent = false = ordinary course).
  // Marks a catalog row as a VATTAMS Competition entry so it's excluded
  // from the public Courses grid/purchase-as-a-course flow and listed on
  // /competitions instead, while still reusing the same courses
  // collection, pricing, and enrolment architecture.
  is_competition?: boolean
  created_at?: string
}

export interface Payment {
  id: string
  student_id: string
  course_id: string
  // Denormalized at creation time so payment/enrolment lists can render
  // without a join — Firestore has none, so the alternative is an extra
  // read per row on every list render.
  course_name: string | null
  student_name: string | null
  amount: number
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  utr_reference: string | null
  submitted_at: string | null
  verified_at: string | null
  verified_by: string | null
  admin_notes: string | null
  created_at: string
}

export interface Enrolment {
  id: string
  student_id: string
  course_id: string
  course_name: string | null
  course_slug: string | null
  status: 'pending' | 'active' | 'revoked'
  enrolled_at: string | null
  created_at: string
}

export interface CertificateVerification {
  certificate_code: string
  student_name: string
  course_name: string | null
  certificate_type: string
  issued_at: string
  is_valid: boolean
}