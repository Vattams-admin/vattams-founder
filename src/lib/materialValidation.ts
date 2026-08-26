// Upload validation for the Learning Materials module — free-tier
// aware limits, an allowlist of mime types per material type (not a
// denylist of "bad" extensions, which is trivially bypassed by
// renaming a file), and a filename sanitizer for the Storage path.
//
// These limits are enforced here (client-side, for a fast/clear error
// message) AND must be mirrored in storage.rules (see repo root) —
// client-side validation alone is not security, it's UX. A student or
// a modified client could skip this file entirely, so the Storage
// rules are the real enforcement boundary.

import type { MaterialType } from '@/types/materials'

export const MAX_FILE_SIZE_BYTES: Record<'pdf' | 'image' | 'video', number> = {
  // Free-tier-conscious defaults for Firebase Storage's Spark plan
  // (5 GB total storage, 1 GB/day download). A handful of large
  // lecture videos can burn through the daily download quota fast, so
  // video is capped well below what Storage could technically hold —
  // see docs/PHASE-MASTER-MATRIX.md-style limitation note in the final
  // report. Admins with genuinely large lecture files should host them
  // externally (YouTube unlisted, Vimeo, etc.) and add them as an
  // External Link material instead.
  pdf: 25 * 1024 * 1024, // 25 MB
  image: 10 * 1024 * 1024, // 10 MB
  video: 200 * 1024 * 1024, // 200 MB
}

// Allowlists, not denylists — only these mime types are accepted, so
// there's no "block .exe" list to keep up to date and no way to sneak
// an executable past a renamed extension. Browsers derive `File.type`
// from content sniffing / the OS, so this isn't perfectly spoof-proof
// either, but combined with the Storage rules' contentType match it
// closes off the practical attack surface for a free-tier LMS.
export const ALLOWED_MIME_TYPES: Record<'pdf' | 'image' | 'video', string[]> = {
  pdf: ['application/pdf'],
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
}

export interface FileValidationResult {
  ok: boolean
  error: string | null
}

export function validateMaterialFile(
  type: 'pdf' | 'image' | 'video',
  file: File
): FileValidationResult {
  const allowedMimes = ALLOWED_MIME_TYPES[type]
  const maxSize = MAX_FILE_SIZE_BYTES[type]

  if (!allowedMimes.includes(file.type)) {
    return {
      ok: false,
      error: `That file doesn't look like a ${type.toUpperCase()} (got "${
        file.type || 'unknown type'
      }"). Allowed: ${allowedMimes.join(', ')}.`,
    }
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file is empty.' }
  }

  if (file.size > maxSize) {
    return {
      ok: false,
      error: `That file is ${formatFileSize(file.size)}, which is over the ${formatFileSize(
        maxSize
      )} limit for ${type} materials.`,
    }
  }

  return { ok: true, error: null }
}

// Strips anything that isn't safe in a Storage path segment, so a
// filename like "Week 1 — Notes (final)!!.pdf" can't break the path or
// smuggle in path traversal ("../"). The original name is kept as
// the material's display title (entered separately by the uploader),
// not derived from this.
export function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename
  const ext = lastDot > 0 ? filename.slice(lastDot + 1) : ''

  const safeBase = base
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)

  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)

  const name = safeBase || 'file'
  return safeExt ? `${name}.${safeExt}` : name
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)

  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`
}

// Material types that involve a Storage upload, vs. ones that store
// their payload directly on the Firestore doc (notes: `content`,
// link: `url`).
export function isUploadType(type: MaterialType): type is 'pdf' | 'image' | 'video' {
  return type === 'pdf' || type === 'image' || type === 'video'
}
