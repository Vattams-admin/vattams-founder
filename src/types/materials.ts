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
  storage_path: string | null

  // For pdf/image/video: the Firebase Storage download URL.
  // For 'link': the external destination URL.
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
// attached server-side (well, client-side, since this project has no
// backend function layer — see lib/materials.ts).
export interface MaterialInput {
  title: string
  description: string
  type: MaterialType
  url: string
  content: string
  is_published: boolean
}
