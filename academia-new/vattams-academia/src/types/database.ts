/**
 * VATTAMS ACADEMIA
 * Frontend database compatibility types.
 *
 * IMPORTANT:
 * This file does NOT change the backend/database.
 * It only provides TypeScript types required by the existing pages.
 */

export type CourseLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'professional';

export type Course = {
  id: string;
  slug: string;
  name: string;
  short_description?: string;
  description?: string;
  level: CourseLevel;
  instructor_name?: string;
  duration_text?: string;
  cover_image_url?: string;
  base_fee: number;
  discount_amount: number;
  is_free: boolean;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type Payment = {
  id: string;
  student_id?: string;
  course_id?: string;
  enrollment_id?: string;
  amount: number;
  utr_reference?: string;
  status: string;
  submitted_at?: string;
  verified_at?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type CertificateVerification = {
  id?: string;
  code: string;
  student_id?: string;
  course_id?: string;
  certificate_id?: string;
  student_name: string;
  course_name?: string | null;
  certificate_type: string;
  issued_at: string;
  is_valid: boolean;
  created_at?: string;
};

/*
 * Generic database type.
 *
 * The actual backend schema remains unchanged.
 * This prevents the frontend from incorrectly treating
 * existing tables as `never` while the project is being
 * migrated/typed.
 */
export type Database = any;
