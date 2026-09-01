// Types for the Firestore `courses/{courseId}/materials/{materialId}`
// subcollection — the Learning Materials module.
//
// This is deliberately separate from `course_modules` / `course_lessons`
// (read by CourseLearn.tsx): lessons are the structured, sequential
// course curriculum with progress tracking, while materials are
// supplementary resources (slide PDFs, reference images, recorded
// videos, reading notes, external links) a tutor/admin attaches to a
// course for enrolled students to browse and open on demand. Nesting
// materials under `courses/{courseId}` keeps per-course reads/writes
// scoped to a single course (no collectionGroup query, no cross-course
// leakage) and mirrors the course-linked structure the brief asked for.

export type MaterialType = 'pdf' | 'image' | 'video' | 'notes' | 'link'

export const MATERIAL_TYPES: { id: MaterialType; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'notes', label: 'Notes' },
  { id: 'link', label: 'External Link' },
]

export function getMaterialTypeLabel(type: MaterialType): string {
  return MATERIAL_TYPES.find((t) => t.id === type)?.label ?? type
}

export interface Material {
  id: string
  course_id: string
  title: string
  description: string | null
  type: MaterialType

  // Set only for uploaded file types (pdf / image / video). Null for
  // 'notes' (no file — see `content`) and 'link' (no file — see `url`).
  // This is the source of truth for locating the file in the private
  // Supabase Storage bucket — see src/lib/supabaseStorage.ts.
  storage_path: string | null

  // For pdf/image/video: NOT a usable download URL. The bucket is
  // private, so uploads leave this null/empty; a short-lived signed
  // URL is requested from storage_path via the course-material Edge
  // Function only when the material is actually opened (see
  // createCourseMaterialDownloadUrl in src/lib/supabaseStorage.ts) and
  // is never persisted here.
  // For 'link': the external destination URL — this is the one case
  // where `url` is meaningful and permanent.
  // Null for 'notes'.
  url: string | null

  thumbnail_url: string | null
  file_size: number | null
  mime_type: string | null

  // Additive field beyond the brief's listed schema: 'notes' materials
  // need somewhere to hold their actual body text. Only set when
  // type === 'notes'. See the final report for why this was added.
  content: string | null

  uploaded_by: string
  uploaded_by_name: string | null
  created_at: string
  updated_at: string
  is_published: boolean
}

// Shape accepted when creating/updating a material from the admin form —
// everything the UI collects before `uploaded_by` / timestamps are
// attached. Firestore writes happen directly from the client
// (lib/materials.ts); the Supabase side (file upload/download/delete)
// goes through the course-material Edge Function, which is the actual
// backend authorization layer for the private Storage bucket.
export interface MaterialInput {
  title: string
  description: string
  type: MaterialType
  url: string
  content: string
  is_published: boolean
}
