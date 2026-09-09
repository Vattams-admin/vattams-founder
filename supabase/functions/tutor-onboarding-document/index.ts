// supabase/functions/tutor-onboarding-document/index.ts
//
// Mirrors supabase/functions/course-material/index.ts's authorization
// pattern exactly: verify the caller's Firebase ID token, look up
// authorization facts in Firestore over REST (using that same verified
// token — no service-account credentials needed for the read), then use
// the Supabase service-role key only for the Storage operation itself.
// Never returns the service-role key to the client.
//
// Bucket: academia-tutor-onboarding-docs (private — see
// supabase/migrations/0006_tutor_onboarding_document_storage.sql).
// Path shape: tutors/{tutorId}/onboarding/{documentType}/{fileName}
//
// Authorization differs from course-material: there is no "enrolled
// student" concept here. Only the owning tutor (path tutorId == caller
// uid) or an admin may create-upload-url / create-download-url. Delete
// is admin-only (a tutor replaces a rejected document by re-uploading
// to the same deterministic path with upsert, which does not require
// delete).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const FIREBASE_PROJECT_ID =
  Deno.env.get('FIREBASE_PROJECT_ID') ||
  Deno.env.get('VITE_FIREBASE_PROJECT_ID')

const BUCKET = 'academia-tutor-onboarding-docs'

const ALLOWED_DOCUMENT_TYPES = [
  'government_id',
  'qualification_certificate',
  'address_proof',
  'bank_proof',
  'profile_photo',
  'professional_certificate',
  'experience_proof',
  'other_supporting_document',
]

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase function environment variables')
}

if (!FIREBASE_PROJECT_ID) {
  throw new Error('Missing FIREBASE_PROJECT_ID')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim() || null
}

async function verifyFirebaseToken(token: string) {
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer,
    audience: FIREBASE_PROJECT_ID,
  })
  if (!payload.sub) throw new Error('Firebase token has no subject')
  return { uid: payload.sub }
}

function firestoreBaseUrl() {
  return (
    `https://firestore.googleapis.com/v1/projects/` +
    `${encodeURIComponent(FIREBASE_PROJECT_ID!)}/databases/(default)/documents`
  )
}

async function firestoreGet(path: string, firebaseToken: string) {
  const response = await fetch(`${firestoreBaseUrl()}/${path}`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  })
  if (response.status === 404) return null
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

interface ParsedPath {
  tutorId: string
  documentType: string
  fileName: string
}

// Only one path shape is valid in this bucket:
//   tutors/{tutorId}/onboarding/{documentType}/{fileName}
// documentType must be one of the known required-document constants —
// this is deliberately a closed allowlist, not just "any safe segment",
// so a caller can't stash files under an arbitrary made-up document
// type that the Firestore metadata / onboarding gate never checks.
function validateStoragePath(path: string): ParsedPath | null {
  if (path.startsWith('/') || path.includes('..')) return null

  const parts = path.split('/')
  if (parts.some((part) => part.length === 0)) return null

  if (parts.length !== 5 || parts[0] !== 'tutors' || parts[2] !== 'onboarding') {
    return null
  }

  const [, tutorId, , documentType, fileName] = parts

  if (
    !isSafeSegment(tutorId) ||
    !ALLOWED_DOCUMENT_TYPES.includes(documentType) ||
    !isSafeFileName(fileName)
  ) {
    return null
  }

  return { tutorId, documentType, fileName }
}

async function isAdmin(uid: string, firebaseToken: string) {
  const document = await firestoreGet(`admins/${encodeURIComponent(uid)}`, firebaseToken)
  if (!document?.fields) return false
  const fields = document.fields
  const active = fields.is_active?.booleanValue === true
  const role = fields.role?.stringValue ?? ''
  return active && ['admin', 'super_admin', 'instructor'].includes(role)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const firebaseToken = getBearerToken(req)
    if (!firebaseToken) {
      return json({ error: 'Authentication required' }, 401)
    }

    const firebaseUser = await verifyFirebaseToken(firebaseToken)

    const body = await req.json()
    const action = body.action

    if (action !== 'create-upload-url' && action !== 'create-download-url' && action !== 'delete') {
      return json(
        { error: 'Unknown action', allowed_actions: ['create-upload-url', 'create-download-url', 'delete'] },
        400
      )
    }

    const path = String(body.path || '').trim()
    if (!path) {
      return json({ error: 'path is required' }, 400)
    }

    const parsedPath = validateStoragePath(path)
    if (!parsedPath) {
      return json({ error: 'Invalid onboarding document path' }, 400)
    }

    const admin = await isAdmin(firebaseUser.uid, firebaseToken)
    const isOwningTutor = firebaseUser.uid === parsedPath.tutorId

    // ---------------------------------------------------------------
    // UPLOAD — owning tutor or admin
    // ---------------------------------------------------------------
    if (action === 'create-upload-url') {
      if (!admin && !isOwningTutor) {
        return json({ error: 'You can only upload your own onboarding documents.' }, 403)
      }

      // upsert: true — a tutor replacing a rejected document re-uploads
      // to the SAME deterministic path (one doc per document type), so
      // the signed URL must be able to overwrite a prior reservation.
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(path, { upsert: true })

      if (error) {
        console.error('createSignedUploadUrl error:', error.message)
        return json({ error: 'Unable to create upload URL' }, 500)
      }

      return json({ ok: true, path, token: data.token })
    }

    // ---------------------------------------------------------------
    // DELETE — admin only
    // ---------------------------------------------------------------
    if (action === 'delete') {
      if (!admin) {
        return json({ error: 'Admin access required' }, 403)
      }

      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) {
        console.error('Storage delete error:', error)
        return json({ error: 'Unable to delete file' }, 500)
      }

      return json({ ok: true, path })
    }

    // ---------------------------------------------------------------
    // DOWNLOAD — owning tutor or admin
    // ---------------------------------------------------------------
    if (action === 'create-download-url') {
      if (!admin && !isOwningTutor) {
        return json({ error: 'You do not have access to this document' }, 403)
      }

      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10)
      if (error) {
        console.error('createSignedUrl error:', error)
        return json({ error: 'Unable to create download URL' }, 500)
      }

      return json({ ok: true, url: data.signedUrl, expires_in: 600 })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (error) {
    console.error('tutor-onboarding-document function error:', error)
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('JWT') ||
      message.includes('signature') ||
      message.includes('issuer') ||
      message.includes('audience')
    ) {
      return json({ error: 'Invalid authentication token' }, 401)
    }
    return json({ error: 'Unexpected server error' }, 500)
  }
})
