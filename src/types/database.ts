export interface Course {
  id: string
  category_id: string | null
  name: string
  slug: string
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
}

export interface CoursePricing {
  course_id: string
  base_fee: number
  discount_amount: number
  final_price: number
  is_free: boolean
}

export interface Payment {
  id: string
  student_id: string
  course_id: string
  amount: number
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  utr_reference: string | null
  submitted_at: string | null
  verified_at: string | null
  admin_notes: string | null
  created_at: string
}

export interface StudentProfile {
  id: string
  full_name: string
  mobile: string | null
  city: string | null
  state: string | null
  country: string | null
}

export interface CertificateVerification {
  certificate_code: string
  student_name: string
  course_name: string | null
  certificate_type: string
  issued_at: string
  is_valid: boolean
}

/*
 * Flexible Supabase schema for the current Academia launch slice.
 *
 * This keeps TypeScript from incorrectly inferring tables as `never`
 * while the final generated Supabase schema is not yet installed.
 */

type AnyRow = Record<string, any>

type AnyTable = {
  Row: AnyRow
  Insert: AnyRow
  Update: AnyRow
  Relationships: []
}

type AnyTables = {
  [table: string]: AnyTable
}

export type Database = {
  public: {
    Tables: AnyTables
    Views: {
      [view: string]: {
        Row: AnyRow
        Relationships: []
      }
    }
    Functions: {
      [fn: string]: {
        Args: AnyRow
        Returns: any
      }
    }
    Enums: {
      [enumName: string]: string
    }
    CompositeTypes: {
      [typeName: string]: AnyRow
    }
  }
}
