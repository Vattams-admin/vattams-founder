import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const FIREBASE_PROJECT_ID =
  Deno.env.get('FIREBASE_PROJECT_ID') ||
  Deno.env.get('VITE_FIREBASE_PROJECT_ID')

const BUCKET = 'academia-course-materials'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase function environment variables')
}

if (!FIREBASE_PROJECT_ID) {
  throw new Error('Missing FIREBASE_PROJECT_ID')
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
)

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get('Authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim() || null
}

async function verifyFirebaseToken(token: string) {
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`

  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer,
    audience: FIREBASE_PROJECT_ID,
  })

  if (!payload.sub) {
    throw new Error('Firebase token has no subject')
  }

  return {
    uid: payload.sub,
    email:
      typeof payload.email === 'string'
        ? payload.email
        : null,
  }
}

function firestoreBaseUrl() {
  return (
    `https://firestore.googleapis.com/v1/projects/` +
    `${encodeURIComponent(FIREBASE_PROJECT_ID!)}/databases/(default)/documents`
  )
}

async function firestoreGet(
  path: string,
  firebaseToken: string
) {
  const response = await fetch(
    `${firestoreBaseUrl()}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
      },
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const text = await response.text()
    console.error('Firestore GET failed:', response.status, text)
    throw new Error('Firestore authorization lookup failed')
  }

  return await response.json()
}

function isSafeSegment(value: string) {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

function isSafeFileName(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..')
}

type ParsedPath =
  | { kind: 'material'; courseId: string; materialId: string; fileName: string }
  | { kind: 'lesson'; courseId: string; moduleId: string; lessonId: string; fileName: string }

// Two path shapes are valid in this bucket:
//   courses/{courseId}/materials/{materialId}/{fileName}          (Learning Materials)
//   courses/{courseId}/modules/{moduleId}/lessons/{lessonId}/{fileName}  (lesson video/PDF)
// Anything else — including traversal, absolute paths, or paths
// outside these two shapes — is rejected.
function validateStoragePath(path: string): ParsedPath | null {
  if (path.startsWith('/') || path.includes('..')) {
    return null
  }

  const parts = path.split('/')

  if (parts.some((part) => part.length === 0)) {
    return null
  }

  if (
    parts.length === 5 &&
    parts[0] === 'courses' &&
    parts[2] === 'materials'
  ) {
    const [, courseId, , materialId, fileName] = parts

    if (
      !isSafeSegment(courseId) ||
      !isSafeSegment(materialId) ||
      !isSafeFileName(fileName)
    ) {
      return null
    }

    return { kind: 'material', courseId, materialId, fileName }
  }

  if (
    parts.length === 7 &&
    parts[0] === 'courses' &&
    parts[2] === 'modules' &&
    parts[4] === 'lessons'
  ) {
    const [, courseId, , moduleId, , lessonId, fileName] = parts

    if (
      !isSafeSegment(courseId) ||
      !isSafeSegment(moduleId) ||
      !isSafeSegment(lessonId) ||
      !isSafeFileName(fileName)
    ) {
      return null
    }

    return { kind: 'lesson', courseId, moduleId, lessonId, fileName }
  }

  return null
}

async function isAdmin(
  uid: string,
  firebaseToken: string
) {
  const document = await firestoreGet(
    `admins/${encodeURIComponent(uid)}`,
    firebaseToken
  )

  if (!document?.fields) {
    return false
  }

  const fields = document.fields

  const active =
    fields.is_active?.booleanValue === true

  const role =
    fields.role?.stringValue ?? ''

  return (
    active &&
    ['admin', 'super_admin', 'instructor'].includes(role)
  )
}

async function isActiveStudent(
  uid: string,
  courseId: string,
  firebaseToken: string
) {
  const enrolmentId = `${uid}_${courseId}`

  const document = await firestoreGet(
    `enrolments/${encodeURIComponent(enrolmentId)}`,
    firebaseToken
  )

  if (!document?.fields) {
    return false
  }

  return document.fields.status?.stringValue === 'active'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    if (req.method !== 'POST') {
      return json(
        { error: 'Method not allowed' },
        405
      )
    }

    const firebaseToken = getBearerToken(req)

    if (!firebaseToken) {
      return json(
        { error: 'Authentication required' },
        401
      )
    }

    const firebaseUser =
      await verifyFirebaseToken(firebaseToken)

    const body = await req.json()
    const action = body.action

    if (
      action !== 'create-upload-url' &&
      action !== 'create-download-url' &&
      action !== 'delete'
    ) {
      return json(
        {
          error: 'Unknown action',
          allowed_actions: [
            'create-upload-url',
            'create-download-url',
            'delete',
          ],
        },
        400
      )
    }

    const path = String(body.path || '').trim()

    if (!path) {
      return json(
        { error: 'path is required' },
        400
      )
    }

    const parsedPath = validateStoragePath(path)

    if (!parsedPath) {
      return json(
        { error: 'Invalid course material path' },
        400
      )
    }

    const admin = await isAdmin(
      firebaseUser.uid,
      firebaseToken
    )

    // -------------------------------------------------------------
    // ADMIN: upload
    // -------------------------------------------------------------
    if (action === 'create-upload-url') {
      if (!admin) {
        return json(
          { error: 'Admin access required' },
          403
        )
      }

      // upsert: true — a signed-upload URL reserves the object's row in
      // storage.objects the moment it is issued, before any bytes are
      // sent. Without upsert, re-requesting a URL for a path that was
      // already reserved (a previous attempt that errored/was retried
      // before the PUT completed, or a legitimate re-upload of a
      // corrected file to the same material) fails with "The resource
      // already exists" — surfaced here as the generic "Unable to
      // create upload URL". The path is fully admin-authorized and
      // deterministic (courseId/materialId/fileName), so allowing it to
      // overwrite its own prior reservation/object is safe.
      const { data, error } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUploadUrl(path, { upsert: true })

      if (error) {
        // Message only (never headers/tokens) — needed to tell apart
        // "resource already exists" vs. bucket/permission/network
        // failures in the function logs without guessing.
        console.error(
          'createSignedUploadUrl error:',
          error.message
        )

        return json(
          {
            error:
              'Unable to create upload URL',
          },
          500
        )
      }

      return json({
        ok: true,
        path,
        token: data.token,
      })
    }

    // -------------------------------------------------------------
    // ADMIN: delete
    // -------------------------------------------------------------
    if (action === 'delete') {
      if (!admin) {
        return json(
          { error: 'Admin access required' },
          403
        )
      }

      const { error } =
        await supabase.storage
          .from(BUCKET)
          .remove([path])

      if (error) {
        console.error(
          'Storage delete error:',
          error
        )

        return json(
          {
            error:
              'Unable to delete file',
          },
          500
        )
      }

      return json({
        ok: true,
        path,
      })
    }

    // -------------------------------------------------------------
    // DOWNLOAD: admin OR active enrolled student
    // -------------------------------------------------------------
    if (action === 'create-download-url') {
      const { courseId } = parsedPath

      // Admins may open published or unpublished materials, and any
      // lesson file. Students must be actively enrolled in the course
      // AND the requested object must be verified (via Firestore) to
      // actually belong to that course before a signed URL is issued —
      // a valid enrolment for course A must never unlock a path for
      // course B, and for materials specifically, an unpublished
      // (draft) material must never be opened by a student even if
      // they know its exact storage path.
      if (!admin) {
        const enrolled = await isActiveStudent(
          firebaseUser.uid,
          courseId,
          firebaseToken
        )

        if (!enrolled) {
          return json(
            {
              error:
                'You do not have access to this course material',
            },
            403
          )
        }

        if (parsedPath.kind === 'material') {
          const { materialId } = parsedPath

          const materialDocument = await firestoreGet(
            `courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}`,
            firebaseToken
          )

          if (!materialDocument?.fields) {
            return json(
              {
                error:
                  'Course material was not found',
              },
              404
            )
          }

          const fields = materialDocument.fields

          const materialCourseId =
            fields.course_id?.stringValue ?? ''

          const materialStoragePath =
            fields.storage_path?.stringValue ?? ''

          const isPublished =
            fields.is_published?.booleanValue === true

          if (
            materialCourseId !== courseId ||
            materialStoragePath !== path ||
            !isPublished
          ) {
            return json(
              {
                error:
                  'This course material is not available',
              },
              403
            )
          }
        } else {
          // kind === 'lesson': verify the lesson document actually
          // belongs to this course/module and that its video_path or
          // pdf_path field is exactly the requested path — an active
          // enrolment authorizes the *course*, not an arbitrary
          // moduleId/lessonId an attacker might guess or construct.
          const { moduleId, lessonId } = parsedPath

          const lessonDocument = await firestoreGet(
            `course_lessons/${encodeURIComponent(lessonId)}`,
            firebaseToken
          )

          if (!lessonDocument?.fields) {
            return json(
              {
                error:
                  'Lesson file was not found',
              },
              404
            )
          }

          const fields = lessonDocument.fields

          const lessonCourseId = fields.course_id?.stringValue ?? ''
          const lessonModuleId = fields.module_id?.stringValue ?? ''
          const lessonVideoPath = fields.video_path?.stringValue ?? ''
          const lessonPdfPath = fields.pdf_path?.stringValue ?? ''

          const pathMatchesLesson =
            lessonVideoPath === path || lessonPdfPath === path

          if (
            lessonCourseId !== courseId ||
            lessonModuleId !== moduleId ||
            !pathMatchesLesson
          ) {
            return json(
              {
                error:
                  'This lesson file is not available',
              },
              403
            )
          }
        }
      }

      const { data, error } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrl(
            path,
            60 * 10
          )

      if (error) {
        console.error(
          'createSignedUrl error:',
          error
        )

        return json(
          {
            error:
              'Unable to create download URL',
          },
          500
        )
      }

      return json({
        ok: true,
        url: data.signedUrl,
        expires_in: 600,
      })
    }

    return json(
      { error: 'Unsupported action' },
      400
    )
  } catch (error) {
    console.error(
      'course-material function error:',
      error
    )

    const message =
      error instanceof Error
        ? error.message
        : ''

    if (
      message.includes('JWT') ||
      message.includes('signature') ||
      message.includes('issuer') ||
      message.includes('audience')
    ) {
      return json(
        { error: 'Invalid authentication token' },
        401
      )
    }

    return json(
      {
        error:
          'Unexpected server error',
      },
      500
    )
  }
})