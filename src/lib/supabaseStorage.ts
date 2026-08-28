// Supabase Storage adapter for VATTAMS ACADEMIA course-learning files.
//
// Firestore remains the source of truth for course/material metadata.
// Supabase Storage is used only for the binary file itself.
//
// This frontend uses the Supabase project's public anon key. The storage
// bucket must therefore be configured in Supabase with policies appropriate
// to this deployment. The bucket is expected to be PUBLIC so students can
// open material URLs without a separate Supabase Auth session; Firebase
// Auth/Firestore remain the application's identity and authorization layer
// for discovering material records.
//
// Required environment variables:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
//   VITE_SUPABASE_STORAGE_BUCKET

function requiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Supabase Storage configuration is missing ${name}. Add it to .env.local and restart the Vite server.`
    )
  }
  return value
}

const supabaseUrl = requiredEnv('VITE_SUPABASE_URL').replace(/\/+$/, '')
const supabaseAnonKey = requiredEnv('VITE_SUPABASE_ANON_KEY')
const bucket = requiredEnv('VITE_SUPABASE_STORAGE_BUCKET')

function objectUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

function objectEndpoint(path: string): string {
  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

export interface SupabaseUploadResult {
  url: string
  storagePath: string
  size: number
  mimeType: string
}

export function uploadCourseMaterial(
  storagePath: string,
  file: File,
  onProgress?: (percent: number) => void
): { promise: Promise<SupabaseUploadResult>; cancel: () => void } {
  const xhr = new XMLHttpRequest()
  let settled = false

  const promise = new Promise<SupabaseUploadResult>((resolve, reject) => {
    xhr.open('POST', objectEndpoint(storagePath), true)
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`)
    xhr.setRequestHeader('apikey', supabaseAnonKey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (settled) return
      settled = true

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          url: objectUrl(storagePath),
          storagePath,
          size: file.size,
          mimeType: file.type,
        })
        return
      }

      let message = `Supabase Storage upload failed (${xhr.status}).`
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        message = body.message || body.error || message
      } catch {
        // Keep the HTTP-status message when the response isn't JSON.
      }
      reject(new Error(message))
    }

    xhr.onerror = () => {
      if (!settled) {
        settled = true
        reject(new Error('Network error while uploading the course material.'))
      }
    }

    xhr.onabort = () => {
      if (!settled) {
        settled = true
        reject(new Error('Upload canceled.'))
      }
    }

    xhr.send(file)
  })

  return {
    promise,
    cancel: () => {
      if (!settled) xhr.abort()
    },
  }
}

export async function deleteCourseMaterialFile(storagePath: string | null): Promise<void> {
  if (!storagePath) return

  const response = await fetch(objectEndpoint(storagePath), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
  })

  if (!response.ok) {
    let message = `Supabase Storage delete failed (${response.status}).`
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      message = body.message || body.error || message
    } catch {
      // Keep the HTTP-status message when the response isn't JSON.
    }
    throw new Error(message)
  }
}
