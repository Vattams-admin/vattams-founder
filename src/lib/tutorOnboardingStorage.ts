// src/lib/tutorOnboardingStorage.ts
//
// Mirrors src/lib/supabaseStorage.ts exactly (same Edge-Function-issues-
// a-signed-URL pattern, same Firebase-ID-token auth), pointed at a
// separate private bucket + Edge Function for tutor onboarding
// documents instead of course materials. Kept as its own module rather
// than parameterizing supabaseStorage.ts because the two buckets have
// different authorization rules (course materials: admin or enrolled
// student; onboarding documents: admin or the owning tutor only) and
// the task spec asks for tutor documents to be independently reviewable
// without touching the course-material path.

import { firebaseAuth } from '@/lib/firebase'
import type { TutorOnboardingDocumentType } from '@/types/tutorOnboarding'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

if (!SUPABASE_URL) {
  throw new Error(
    'VITE_SUPABASE_URL is missing. Add it to the environment, then restart Vite.'
  )
}

const SUPABASE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/tutor-onboarding-document`
const BUCKET = 'academia-tutor-onboarding-docs'

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
    throw new Error('You must be signed in to manage onboarding documents.')
  }
  return user.getIdToken()
}

async function callFunction(body: Record<string, unknown>, signal?: AbortSignal): Promise<FunctionResponse> {
  const token = await getFirebaseToken()

  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  let data: FunctionResponse = {}
  try {
    data = (await response.json()) as FunctionResponse
  } catch {
    // Keep the HTTP status as the fallback error.
  }

  if (!response.ok) {
    throw new Error(data.error || `Onboarding document service failed (${response.status}).`)
  }

  return data
}

export function getTutorOnboardingStoragePath(
  tutorId: string,
  documentType: TutorOnboardingDocumentType,
  fileName: string
): string {
  // Matches the spec's recommended pattern exactly:
  // tutors/{tutorId}/onboarding/{documentId}/{safeFileName}
  return `tutors/${tutorId}/onboarding/${documentType}/${fileName}`
}

export function uploadTutorOnboardingDocument(
  storagePath: string,
  file: File,
  onProgress?: (percent: number) => void
): { promise: Promise<{ storagePath: string; size: number }>; cancel: () => void } {
  const controller = new AbortController()
  let xhr: XMLHttpRequest | null = null
  let settled = false

  const promise = (async () => {
    try {
      onProgress?.(0)

      const result = await callFunction(
        { action: 'create-upload-url', path: storagePath },
        controller.signal
      )

      if (!result.token) {
        throw new Error('Upload authorization token was not returned.')
      }

      const uploadUrl =
        `${SUPABASE_URL}/storage/v1/object/upload/sign/` +
        `${encodeURIComponent(BUCKET)}/${storagePath}?token=` +
        encodeURIComponent(result.token)

      const request = new XMLHttpRequest()
      xhr = request

      const uploadPromise = new Promise<void>((resolve, reject) => {
        request.open('PUT', uploadUrl, true)
        request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress?.(Math.round((event.loaded / event.total) * 100))
          }
        }

        request.onload = () => {
          if (request.status >= 200 && request.status < 300) resolve()
          else reject(new Error(`Upload failed (${request.status}).`))
        }
        request.onerror = () => reject(new Error('Network error while uploading the document.'))
        request.onabort = () => reject(new Error('Upload canceled.'))

        request.send(file)
      })

      await uploadPromise

      if (settled) throw new Error('Upload canceled.')

      onProgress?.(100)

      // Private bucket — no public URL is ever produced. Only the
      // storage path is persisted (see saveTutorOnboardingDocumentUpload
      // in src/lib/tutorOnboardingDocuments.ts); a fresh signed download
      // URL is generated on demand when a tutor/admin opens the file.
      return { storagePath, size: file.size }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Upload canceled.')
      throw error
    }
  })()

  return {
    promise,
    cancel: () => {
      settled = true
      controller.abort()
      xhr?.abort()
    },
  }
}

export async function createTutorOnboardingDownloadUrl(storagePath: string): Promise<string> {
  const result = await callFunction({ action: 'create-download-url', path: storagePath })
  if (!result.url) {
    throw new Error('Download URL was not returned.')
  }
  return result.url
}
