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

async function firestoreQuery(
  structuredQuery: unknown,
  firebaseToken: string
) {
  const response = await fetch(
    `${firestoreBaseUrl()}:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery,
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    console.error('Firestore query failed:', response.status, text)
    throw new Error('Firestore authorization query failed')
  }

  return await response.json()
}

function validateMaterialPath(path: string) {
  const parts = path.split('/')

  // Required path:
  // courses/{courseId}/materials/{materialId}/{fileName}
  if (parts.length !== 5) {
    return null
  }

  if (parts[0] !== 'courses' || parts[2] !== 'materials') {
    return null
  }

  const [, courseId, , materialId, fileName] = parts

  if (!courseId || !materialId || !fileName) {
    return null
  }

  // Prevent traversal or encoded/path-separator abuse.
  if (
    courseId.includes('..') ||
    materialId.includes('..') ||
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    return null
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(courseId)) {
    return null
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(materialId)) {
    return null
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return null
  }

  return {
    courseId,
    materialId,
    fileName,
  }
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

    const parsedPath = validateMaterialPath(path)

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

      const { data, error } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUploadUrl(path)

      if (error) {
        console.error(
          'createSignedUploadUrl error:',
          error
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
      const { courseId, materialId } = parsedPath

      // Admins may open published or unpublished materials.
      // Students must be actively enrolled AND the material itself
      // must be published. The Firestore document is also checked
      // against the requested Storage path so a valid enrolment
      // cannot be used to obtain an unrelated file.
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
