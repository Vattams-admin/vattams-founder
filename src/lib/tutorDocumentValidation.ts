// src/lib/tutorDocumentValidation.ts
//
// Same allowlist-not-denylist approach as src/lib/materialValidation.ts,
// sized for identity/certificate documents (photos of ID cards, scanned
// PDFs) rather than course video/PDF content. Reuses sanitizeFilename
// from materialValidation.ts rather than duplicating it.

export { sanitizeFilename, formatFileSize } from '@/lib/materialValidation'

export const TUTOR_DOCUMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const TUTOR_DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]

export interface FileValidationResult {
  ok: boolean
  error: string | null
}

export function validateTutorDocumentFile(file: File): FileValidationResult {
  if (!TUTOR_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `That file type isn't supported (got "${file.type || 'unknown type'}"). Upload a PDF, PNG, JPG, or WEBP.`,
    }
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.' }
  }

  if (file.size > TUTOR_DOCUMENT_MAX_SIZE_BYTES) {
    return {
      ok: false,
      error: `That file is too large. Documents must be under ${TUTOR_DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024)} MB.`,
    }
  }

  return { ok: true, error: null }
}
