// Data layer for the Learning Materials module.
//
// Firestore: courses/{courseId}/materials/{materialId} — a subcollection
// of the existing `courses` collection (see src/types/database.ts),
// following the same course-linked pattern as `course_modules` /
// `course_lessons` used by CourseLearn.tsx.
//
// Storage: courses/{courseId}/materials/{materialId}/{filename} — mirrors
// the Firestore path so a material's file always lives alongside its
// metadata doc and both can be located/cleaned up from just the two IDs.
//
// There is no server/Cloud Functions layer in this project (frontend
// talks to Firebase directly), so uploads, validation, and deletes all
// happen from the client, same as every other write in this codebase.
// Firestore security rules protect the metadata; Supabase Storage policies
// protect the file operations. This file does not enforce authorization on
// its own.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import {
  deleteCourseMaterialFile,
  uploadCourseMaterial,
  type SupabaseUploadResult,
} from '@/lib/supabaseStorage'
import type { Material, MaterialInput, MaterialType } from '@/types/materials'
import { sanitizeFilename } from '@/lib/materialValidation'

function materialsCollection(courseId: string) {
  return collection(firestore, 'courses', courseId, 'materials')
}

function materialDocRef(courseId: string, materialId: string) {
  return doc(firestore, 'courses', courseId, 'materials', materialId)
}

function toIsoString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return ''
}

function fromFirestore(id: string, data: Record<string, unknown>): Material {
  return {
    id,
    course_id: typeof data.course_id === 'string' ? data.course_id : '',
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : null,
    type: (typeof data.type === 'string' ? data.type : 'notes') as MaterialType,
    storage_path: typeof data.storage_path === 'string' ? data.storage_path : null,
    url: typeof data.url === 'string' ? data.url : null,
    thumbnail_url: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
    file_size: typeof data.file_size === 'number' ? data.file_size : null,
    mime_type: typeof data.mime_type === 'string' ? data.mime_type : null,
    content: typeof data.content === 'string' ? data.content : null,
    uploaded_by: typeof data.uploaded_by === 'string' ? data.uploaded_by : '',
    uploaded_by_name: typeof data.uploaded_by_name === 'string' ? data.uploaded_by_name : null,
    created_at: toIsoString(data.created_at),
    updated_at: toIsoString(data.updated_at),
    is_published: data.is_published === true,
  }
}

export interface MaterialListResult {
  rows: Material[]
  error: string | null
}

function friendlyError(error: unknown, context: string): string {
  const code = (error as { code?: string })?.code
  if (import.meta.env.DEV) console.error(`[materials] ${context}:`, error)

  if (code === 'permission-denied') {
    return "You don't have permission to do that. Check that you're signed in and authorized for this course."
  }
  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Network error. Please check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

// Student-facing read: published materials only. Sorted client-side
// (rather than an `orderBy` in the query) so this doesn't require a
// Firestore composite index on every course subcollection before it
// works — see the final report.
export async function listPublishedMaterials(courseId: string): Promise<MaterialListResult> {
  try {
    const snapshot = await getDocs(
      query(materialsCollection(courseId), where('is_published', '==', true))
    )
    const rows = snapshot.docs
      .map((d) => fromFirestore(d.id, d.data()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { rows, error: null }
  } catch (error) {
    return { rows: [], error: friendlyError(error, 'published materials') }
  }
}

// Admin/tutor-facing read: everything, published or not.
export async function listAllMaterials(courseId: string): Promise<MaterialListResult> {
  try {
    const snapshot = await getDocs(query(materialsCollection(courseId), orderBy('created_at', 'desc')))
    const rows = snapshot.docs.map((d) => fromFirestore(d.id, d.data()))
    return { rows, error: null }
  } catch (error) {
    return { rows: [], error: friendlyError(error, 'materials') }
  }
}

export async function getMaterial(courseId: string, materialId: string): Promise<Material | null> {
  const snap = await getDoc(materialDocRef(courseId, materialId))
  if (!snap.exists()) return null
  return fromFirestore(snap.id, snap.data())
}

// Generates a Firestore doc id up front (without writing anything yet)
// so the Storage path can embed the same id the metadata doc will use —
// the file and its record are linkable from either direction.
export function newMaterialId(courseId: string): string {
  return doc(materialsCollection(courseId)).id
}

export function materialStoragePath(courseId: string, materialId: string, filename: string): string {
  return `courses/${courseId}/materials/${materialId}/${sanitizeFilename(filename)}`
}

export type UploadResult = SupabaseUploadResult

// Uploads a file for a pdf/image/video material to Supabase Storage and
// resolves once the object is available at its public URL. `onProgress`
// receives 0–100.
export function uploadMaterialFile(
  courseId: string,
  materialId: string,
  file: File,
  onProgress?: (percent: number) => void
): { promise: Promise<UploadResult>; cancel: () => void } {
  const storagePath = materialStoragePath(courseId, materialId, file.name)
  const { promise, cancel } = uploadCourseMaterial(storagePath, file, onProgress)
  return { promise, cancel }
}

export async function deleteMaterialFile(storagePath: string | null): Promise<void> {
  if (!storagePath) return
  try {
    await deleteCourseMaterialFile(storagePath)
  } catch (error) {
    // A missing/already-deleted object is not fatal — the Firestore doc
    // deletion remains the source of truth for whether the material exists.
    if (import.meta.env.DEV) console.error('[materials] Failed to delete Supabase Storage file:', error)
  }
}

export interface CreateMaterialArgs {
  courseId: string
  materialId: string
  input: MaterialInput
  upload: UploadResult | null
  uploadedBy: string
  uploadedByName: string | null
}

export async function createMaterial({
  courseId,
  materialId,
  input,
  upload,
  uploadedBy,
  uploadedByName,
}: CreateMaterialArgs): Promise<{ error: string | null }> {
  try {
    const now = new Date().toISOString()
    await setDoc(materialDocRef(courseId, materialId), {
      course_id: courseId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      type: input.type,
      storage_path: upload?.storagePath ?? null,
      url: upload?.url ?? (input.type === 'link' ? input.url.trim() : null),
      thumbnail_url: null,
      file_size: upload?.size ?? null,
      mime_type: upload?.mimeType ?? null,
      content: input.type === 'notes' ? input.content : null,
      uploaded_by: uploadedBy,
      uploaded_by_name: uploadedByName,
      created_at: now,
      updated_at: now,
      is_published: input.is_published,
    })
    return { error: null }
  } catch (error) {
    return { error: friendlyError(error, 'material creation') }
  }
}

export interface UpdateMaterialArgs {
  courseId: string
  materialId: string
  input: MaterialInput
  upload: UploadResult | null
  previousStoragePath: string | null
}

// Replacing a material's file (e.g. re-uploading a corrected PDF)
// deletes the old Storage object after the new one is safely written
// and the Firestore doc points at it — never the other way round, so a
// failed upload never leaves a material pointing at a deleted file.
export async function updateMaterial({
  courseId,
  materialId,
  input,
  upload,
  previousStoragePath,
}: UpdateMaterialArgs): Promise<{ error: string | null }> {
  try {
    await updateDoc(materialDocRef(courseId, materialId), {
      title: input.title.trim(),
      description: input.description.trim() || null,
      ...(upload
        ? {
            storage_path: upload.storagePath,
            url: upload.url,
            file_size: upload.size,
            mime_type: upload.mimeType,
          }
        : input.type === 'link'
          ? { url: input.url.trim() }
          : {}),
      content: input.type === 'notes' ? input.content : null,
      is_published: input.is_published,
      updated_at: new Date().toISOString(),
    })

    if (upload && previousStoragePath && previousStoragePath !== upload.storagePath) {
      try {
      await deleteMaterialFile(previousStoragePath)
    } catch (error) {
      // Non-fatal: the replacement itself already succeeded in Firestore.
      // Firestore metadata must not be reported as failed just because
      // cleanup of the old Storage file could not be completed.
      console.error(
        'Failed to delete previous material file from storage:',
        error
      )
    }
    }

    return { error: null }
  } catch (error) {
    return { error: friendlyError(error, 'material update') }
  }
}

export async function togglePublishMaterial(
  courseId: string,
  materialId: string,
  isPublished: boolean
): Promise<{ error: string | null }> {
  try {
    await updateDoc(materialDocRef(courseId, materialId), {
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    return { error: null }
  } catch (error) {
    return { error: friendlyError(error, 'publish status') }
  }
}

export async function deleteMaterial(
  courseId: string,
  materialId: string,
  storagePath: string | null
): Promise<{ error: string | null; deleted: boolean; storageCleanupFailed: boolean }> {
  try {
    await deleteDoc(materialDocRef(courseId, materialId))
  } catch (error) {
    return {
      error: friendlyError(error, 'material deletion'),
      deleted: false,
      storageCleanupFailed: false,
    }
  }

  if (!storagePath) {
    return { error: null, deleted: true, storageCleanupFailed: false }
  }

  try {
    await deleteCourseMaterialFile(storagePath)
    return { error: null, deleted: true, storageCleanupFailed: false }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[materials] Storage cleanup failed after metadata deletion:', error)
    }
    return {
      error: 'Material deleted, but its Storage file could not be cleaned up.',
      deleted: true,
      storageCleanupFailed: true,
    }
  }
}
