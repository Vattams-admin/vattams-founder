import { firebaseAuth } from '@/lib/firebase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/course-material`

const DEFAULT_BUCKET =
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'academia-course-materials'

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
  message?: string
  details?: string
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

  let response: Response
  try {
    response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (networkError) {
    console.error(
      '[supabaseStorage] Network-level failure calling course-material:',
      networkError
    )

    throw new Error(
      'Could not reach the course material service. Check your internet connection and try again — ' +
        'if this keeps happening, the upload service itself may be temporarily unavailable.'
    )
  }

  let data: FunctionResponse = {}

  try {
    data = (await response.json()) as FunctionResponse
  } catch {
    // Keep the HTTP status as the fallback error.
  }

  if (!response.ok) {
    if (import.meta.env.DEV && (data.details || data.message)) {
      console.error('course-material function error:', {
        status: response.status,
        error: data.error,
        message: data.message,
        details: data.details,
      })
    }

    throw new Error(
      data.error === 'UPLOAD_URL_FAILED'
        ? data.message || 'Unable to create upload URL'
        : data.error || `Course material service failed (${response.status}).`
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
  let xhr: XMLHttpRequest | null = null
  let settled = false

  const promise = (async (): Promise<SupabaseUploadResult> => {
    try {
      onProgress?.(0)

      const result = await callCourseMaterialFunction({
        action: 'create-upload-url',
        path: storagePath,
      })

      if (!result.token) {
        throw new Error('Upload authorization token was not returned.')
      }

      const uploadUrl =
        `${SUPABASE_URL}/storage/v1/object/upload/sign/` +
        `${encodeURIComponent(DEFAULT_BUCKET)}/${storagePath}?token=` +
        encodeURIComponent(result.token)

      const request = new XMLHttpRequest()
      xhr = request

      const uploadPromise = new Promise<void>((resolve, reject) => {
        request.open('PUT', uploadUrl, true)

        request.setRequestHeader(
          'Content-Type',
          file.type || 'application/octet-stream'
        )

        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress?.(
              Math.round((event.loaded / event.total) * 100)
            )
          }
        }

        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve()
          } else {
            reject(
              new Error(
                `Supabase Storage upload failed (${request.status}).`
              )
            )
          }
        }

        request.onerror = () => {
          reject(
            new Error(
              'Network error while uploading the course material.'
            )
          )
        }

        request.onabort = () => {
          reject(new Error('Upload canceled.'))
        }

        request.send(file)
      })

      await uploadPromise

      if (settled) {
        throw new Error('Upload canceled.')
      }

      onProgress?.(100)

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
      if (settled) return

      settled = true
      controller.abort()
      xhr?.abort()
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
