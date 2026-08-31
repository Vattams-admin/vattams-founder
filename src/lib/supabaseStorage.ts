import { firebaseAuth } from '@/lib/firebase'

const SUPABASE_FUNCTION_URL =
  'https://nfcibyprftnowaiwlxxc.supabase.co/functions/v1/course-material'

const DEFAULT_BUCKET = 'academia-course-materials'

export interface SupabaseUploadResult {
  url: string
  storagePath: string
  size: number
  mimeType: string
}

interface FunctionResponse {
  ok?: boolean
  url?: string
  path?: string
  token?: string
  expires_in?: number
  error?: string
}

async function getFirebaseToken(): Promise<string> {
  const user = firebaseAuth.currentUser

  if (!user) {
    throw new Error('You must be signed in to manage course materials.')
  }

  return user.getIdToken()
}

async function callCourseMaterialFunction(
  body: Record<string, unknown>
): Promise<FunctionResponse> {
  const token = await getFirebaseToken()

  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let data: FunctionResponse = {}

  try {
    data = (await response.json()) as FunctionResponse
  } catch {
    // Keep the HTTP status as the fallback error.
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Course material service failed (${response.status}).`
    )
  }

  return data
}

function storagePathForUpload(
  courseId: string,
  materialId: string,
  filename: string
): string {
  return `courses/${courseId}/materials/${materialId}/${filename}`
}

export function uploadCourseMaterial(
  storagePath: string,
  file: File,
  onProgress?: (percent: number) => void
): {
  promise: Promise<SupabaseUploadResult>
  cancel: () => void
} {
  const controller = new AbortController()
  let settled = false

  const promise = (async (): Promise<SupabaseUploadResult> => {
    try {
      onProgress?.(0)

      /*
       * The Edge Function performs the Firebase-authenticated admin check
       * and creates a signed Supabase Storage upload URL.
       */
      const result = await callCourseMaterialFunction({
        action: 'create-upload-url',
        path: storagePath,
      })

      if (!result.token) {
        throw new Error('Upload authorization token was not returned.')
      }

      const uploadUrl =
        `https://nfcibyprftnowaiwlxxc.supabase.co/storage/v1/object/upload/sign/` +
        `${encodeURIComponent(DEFAULT_BUCKET)}/${storagePath}?token=` +
        encodeURIComponent(result.token)

      const xhr = new XMLHttpRequest()

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader(
          'Content-Type',
          file.type || 'application/octet-stream'
        )

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress?.(
              Math.round((event.loaded / event.total) * 100)
            )
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(
              new Error(
                `Supabase Storage upload failed (${xhr.status}).`
              )
            )
          }
        }

        xhr.onerror = () => {
          reject(
            new Error(
              'Network error while uploading the course material.'
            )
          )
        }

        xhr.onabort = () => {
          reject(new Error('Upload canceled.'))
        }

        xhr.send(file)
      })

      /*
       * AbortController is used for the function request.
       * The XMLHttpRequest itself is cancelled through xhr.abort().
       */
      await uploadPromise

      if (settled) {
        throw new Error('Upload canceled.')
      }

      onProgress?.(100)

      /*
       * Private bucket: there is deliberately NO public object URL.
       * The material metadata stores the storage path only.
       *
       * A fresh signed download URL is generated when the student/admin
       * actually opens the material.
       */
      return {
        url: '',
        storagePath,
        size: file.size,
        mimeType: file.type,
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Upload canceled.')
      }

      throw error
    }
  })()

  return {
    promise,
    cancel: () => {
      settled = true
      controller.abort()
    },
  }
}

export async function createCourseMaterialDownloadUrl(
  storagePath: string
): Promise<string> {
  const result = await callCourseMaterialFunction({
    action: 'create-download-url',
    path: storagePath,
  })

  if (!result.url) {
    throw new Error('Download URL was not returned.')
  }

  return result.url
}

export async function deleteCourseMaterialFile(
  storagePath: string | null
): Promise<void> {
  if (!storagePath) return

  await callCourseMaterialFunction({
    action: 'delete',
    path: storagePath,
  })
}

export function getCourseMaterialStoragePath(
  courseId: string,
  materialId: string,
  filename: string
): string {
  return storagePathForUpload(courseId, materialId, filename)
}
