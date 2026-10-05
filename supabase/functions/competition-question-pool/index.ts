import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from 'npm:jose@6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SECRET_KEYS = JSON.parse(
  Deno.env.get('SUPABASE_SECRET_KEYS')!,
)

const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_SECRET_KEYS['default']

const FIREBASE_PROJECT_ID = 'vattams-academia'

const FIREBASE_SERVICE_ACCOUNT_JSON =
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || ''

if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON')
}

const serviceAccount = JSON.parse(
  FIREBASE_SERVICE_ACCOUNT_JSON,
)

const BUCKET = 'academia-course-materials'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase function environment variables')
}

if (!FIREBASE_PROJECT_ID) {
  throw new Error('Missing FIREBASE_PROJECT_ID')
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
)

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AgeBand =
  | 'up_to_8'
  | 'age_9_12'
  | 'age_13_15'
  | 'age_16_plus'

type AgePool = Record<string, string[]>

type CompetitionConfig = {
  competition: string
  course_id: string
  age_pools_path: string
  blueprints: Record<AgeBand, readonly [string, number][]>
}

type Registry = {
  version: number
  competitions: Record<string, {
    course_id: string
    competition: string
    slug: string
    age_pools: string
    selection_blueprint?: Record<AgeBand, readonly [string, number][]>
    per_attempt?: number
    enabled?: boolean
  }>
}

async function loadRegistry(): Promise<Registry> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download('competitions/registry.json')

  if (error) {
    console.error('Competition registry download error:', error.message)
    throw new Error('Unable to load competition runtime registry')
  }

  const registry = JSON.parse(await data.text()) as Registry
  if (!registry?.competitions || typeof registry.competitions !== 'object') {
    throw new Error('Competition runtime registry is invalid')
  }
  return registry
}

function normalizeBlueprint(
  value: unknown,
  competition: string,
): Record<AgeBand, readonly [string, number][]> {
  if (!value || typeof value !== 'object') {
    throw new Error(`Missing selection blueprint for ${competition}`)
  }

  const blueprint = value as Record<string, unknown>
  const bands: AgeBand[] = ['up_to_8', 'age_9_12', 'age_13_15', 'age_16_plus']
  const result = {} as Record<AgeBand, readonly [string, number][]>

  for (const band of bands) {
    const entries = blueprint[band]
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`Missing selection blueprint for ${competition}/${band}`)
    }

    const normalized = entries.map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
        throw new Error(`Invalid selection blueprint for ${competition}/${band}`)
      }
      const count = Number(pair[1])
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`Invalid selection count for ${competition}/${band}`)
      }
      return [pair[0], count] as [string, number]
    })

    if (normalized.reduce((sum, pair) => sum + pair[1], 0) !== 30) {
      throw new Error(`Selection blueprint for ${competition}/${band} must total 30`)
    }

    result[band] = normalized
  }

  return result
}

async function loadCompetitionConfig(courseId: string): Promise<CompetitionConfig | null> {
  const registry = await loadRegistry()
  const entry = registry.competitions[courseId]

  if (!entry || entry.enabled !== true) return null
  if (entry.course_id !== courseId) throw new Error(`Registry course_id mismatch for ${courseId}`)
  if (!entry.age_pools) throw new Error(`Missing age_pools for ${entry.competition}`)
  if ((entry.per_attempt ?? 30) !== 30) throw new Error(`Invalid per_attempt for ${entry.competition}`)

  return {
    competition: entry.competition,
    course_id: entry.course_id,
    age_pools_path: entry.age_pools,
    blueprints: normalizeBlueprint(entry.selection_blueprint, entry.competition),
  }
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

function getBearerToken(req: Request): string | null {
  const authorization =
    req.headers.get('Authorization') || ''

  if (!authorization.startsWith('Bearer ')) {
    return null
  }

  return (
    authorization
      .slice('Bearer '.length)
      .trim() || null
  )
}

async function verifyFirebaseToken(
  token: string,
) {
  const issuer =
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`

  try {
    const { payload } = await jwtVerify(
      token,
      firebaseJWKS,
      {
        issuer,
        audience: FIREBASE_PROJECT_ID,
      },
    )

    if (!payload.sub) {
      throw new Error(
        'Firebase token has no subject',
      )
    }

    return {
      uid: payload.sub,
    }
  } catch (error) {
    const details =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error)

    console.error(
      'Firebase JWT verification failed:',
      details,
    )

    throw new Error(
      `Firebase JWT verification failed: ${details}`,
    )
  }
}

function firestoreBaseUrl() {
  return (
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(FIREBASE_PROJECT_ID) +
    '/databases/(default)/documents'
  )
}

async function getGoogleAccessToken() {
  const privateKey = await importPKCS8(
    serviceAccount.private_key,
    'RS256',
  )

  const now = Math.floor(Date.now() / 1000)

  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
    })
    .setIssuer(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const response = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:
          'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      'Unable to obtain Firestore service access token',
    )
  }

  const data = await response.json()

  if (!data.access_token) {
    throw new Error(
      'Firestore service access token was not returned',
    )
  }

  return data.access_token as string
}

async function firestoreCommit(
  writes: unknown[],
  accessToken: string,
) {
  const response = await fetch(
    `${firestoreBaseUrl()}:commit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ writes }),
    },
  )

  if (!response.ok) {
    const text = await response.text()

    console.error(
      'Firestore attempt commit failed:',
      text,
    )

    throw new Error(
      'Unable to create competition attempt',
    )
  }

  return await response.json()
}

async function firestoreGet(
  path: string,
  firebaseToken: string,
) {
  const response = await fetch(
    `${firestoreBaseUrl()}/${path}`,
    {
      headers: {
        Authorization:
          `Bearer ${firebaseToken}`,
      },
    },
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const text = await response.text()

    console.error(
      'Firestore GET failed:',
      response.status,
      text,
    )

    throw new Error(
      'Firestore authorization lookup failed',
    )
  }

  return await response.json()
}

async function isAdmin(
  uid: string,
  firebaseToken: string,
): Promise<boolean> {
  const document = await firestoreGet(
    `admins/${encodeURIComponent(uid)}`,
    firebaseToken,
  )

  if (!document?.fields) {
    return false
  }

  const fields = document.fields

  return (
    fields.is_active?.booleanValue === true &&
    [
      'admin',
      'super_admin',
      'instructor',
    ].includes(
      fields.role?.stringValue ?? '',
    )
  )
}

async function isActiveStudent(
  uid: string,
  courseId: string,
  firebaseToken: string,
): Promise<boolean> {
  const enrolmentId =
    `${uid}_${courseId}`

  const document = await firestoreGet(
    `enrolments/${encodeURIComponent(enrolmentId)}`,
    firebaseToken,
  )

  if (!document?.fields) {
    return false
  }

  return (
    document.fields.status?.stringValue ===
    'active'
  )
}

function getStudentDob(
  document: any,
): string | null {
  const value =
    document?.fields?.date_of_birth?.stringValue

  return typeof value === 'string' && value
    ? value
    : null
}

function calculateAge(
  dateOfBirth: string,
): number | null {
  const dob =
    new Date(`${dateOfBirth}T00:00:00`)

  if (Number.isNaN(dob.getTime())) {
    return null
  }

  const now = new Date()

  let age =
    now.getFullYear() -
    dob.getFullYear()

  const monthDiff =
    now.getMonth() -
    dob.getMonth()

  if (
    monthDiff < 0 ||
    (
      monthDiff === 0 &&
      now.getDate() < dob.getDate()
    )
  ) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function getAgeBand(
  age: number,
): AgeBand | null {
  if (!Number.isInteger(age) || age < 0) {
    return null
  }

  if (age <= 8) return 'up_to_8'
  if (age <= 12) return 'age_9_12'
  if (age <= 15) return 'age_13_15'

  return 'age_16_plus'
}

function shuffle<T>(
  items: T[],
): T[] {
  const result = [...items]

  for (
    let i = result.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = Math.floor(
      Math.random() * (i + 1),
    )

    ;[result[i], result[j]] =
      [result[j], result[i]]
  }

  return result
}

function selectQuestions(
  pools: AgePool,
  blueprint: readonly [
    string,
    number,
  ][],
): string[] {
  const selected: string[] = []

  for (
    const [subtopic, count] of blueprint
  ) {
    const pool = pools[subtopic]

    if (!Array.isArray(pool)) {
      throw new Error(
        `Missing age-pool subtopic: ${subtopic}`,
      )
    }

    if (pool.length < count) {
      throw new Error(
        `Insufficient questions for ${subtopic}`,
      )
    }

    selected.push(
      ...shuffle(pool).slice(0, count),
    )
  }

  const unique = new Set(selected)

  if (
    selected.length !== 30 ||
    unique.size !== 30
  ) {
    throw new Error(
      'Question selection did not produce 30 unique questions',
    )
  }

  return shuffle(selected)
}

async function loadAgePools(
  path: string,
): Promise<AgePool> {
  const { data, error } =
    await supabase.storage
      .from(BUCKET)
      .download(path)

  if (error) {
    console.error(
      'Age-pool download error:',
      error.message,
    )

    throw new Error(
      'Unable to load competition question pools',
    )
  }

  return JSON.parse(
    await data.text(),
  ) as AgePool
}

async function loadCompetition(
  courseId: string,
  firebaseToken: string,
) {
  return await firestoreGet(
    `courses/${encodeURIComponent(courseId)}`,
    firebaseToken,
  )
}

function firestoreStringField(
  document: any,
  field: string,
): string | null {
  const value =
    document?.fields?.[field]?.stringValue

  return typeof value === 'string'
    ? value
    : null
}

function firestoreBooleanField(
  document: any,
  field: string,
): boolean | null {
  const value =
    document?.fields?.[field]?.booleanValue

  return typeof value === 'boolean'
    ? value
    : null
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
        405,
      )
    }

    const firebaseToken =
      getBearerToken(req)

    if (!firebaseToken) {
      return json(
        {
          error:
            'Authentication required',
        },
        401,
      )
    }

    const firebaseUser =
      await verifyFirebaseToken(
        firebaseToken,
      )

    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const courseId =
      typeof body?.course_id === 'string'
        ? body.course_id.trim()
        : ''

    if (!courseId) {
      return json(
        {
          error:
            'course_id is required.',
        },
        400,
      )
    }

    const courseDocument =
      await loadCompetition(
        courseId,
        firebaseToken,
      )

    if (!courseDocument?.fields) {
      return json(
        {
          error:
            'Competition course not found.',
        },
        404,
      )
    }

    const isCompetition =
      firestoreBooleanField(
        courseDocument,
        'is_competition',
      )

    if (isCompetition !== true) {
      return json(
        {
          error:
            'The selected course is not a competition.',
        },
        400,
      )
    }

    const competitionName =
      firestoreStringField(
        courseDocument,
        'name',
      ) || 'Competition'

    const config =
      await loadCompetitionConfig(courseId)

    if (!config) {
      return json(
        {
          error:
            'Question bank is not configured for this competition yet.',
          course_id: courseId,
          competition: competitionName,
        },
        409,
      )
    }

    const adminUser =
      await isAdmin(
        firebaseUser.uid,
        firebaseToken,
      )

    if (!adminUser) {
      const enrolled =
        await isActiveStudent(
          firebaseUser.uid,
          courseId,
          firebaseToken,
        )

      if (!enrolled) {
        return json(
          {
            error:
              'You do not have access to this competition.',
          },
          403,
        )
      }
    }

    const studentDocument =
      await firestoreGet(
        `students/${encodeURIComponent(firebaseUser.uid)}`,
        firebaseToken,
      )

    const dateOfBirth =
      getStudentDob(
        studentDocument,
      )

    if (!dateOfBirth) {
      return json(
        {
          error:
            'Date of birth is required for competition question selection.',
        },
        400,
      )
    }

    const age =
      calculateAge(dateOfBirth)

    if (age === null) {
      return json(
        {
          error:
            'Student date of birth is invalid.',
        },
        400,
      )
    }

    const ageBand =
      getAgeBand(age)

    if (!ageBand) {
      return json(
        {
          error:
            'Student age is not eligible.',
        },
        400,
      )
    }

    const allAgePools =
      await loadAgePools(
        config.age_pools_path,
      )

    const pools =
      allAgePools[ageBand]

    if (!pools) {
      return json(
        {
          error:
            'Question pool is not configured for this age band.',
          competition:
            config.competition,
          age_band: ageBand,
        },
        409,
      )
    }

    const blueprint =
      config.blueprints[ageBand]

    if (!blueprint) {
      return json(
        {
          error:
            'Question blueprint is not configured for this age band.',
          competition:
            config.competition,
          age_band: ageBand,
        },
        409,
      )
    }

    const questionIds =
      selectQuestions(
        pools,
        blueprint,
      )

    const attemptId = crypto.randomUUID()
    const firestoreAccessToken =
      await getGoogleAccessToken()

    const now = new Date().toISOString()

    await firestoreCommit(
      [
        {
          update: {
            name:
              `${firestoreBaseUrl()}/competition_attempts/${attemptId}`,
            fields: {
              student_id: {
                stringValue:
                  firebaseUser.uid,
              },
              course_id: {
                stringValue:
                  courseId,
              },
              status: {
                stringValue:
                  'in_progress',
              },
              started_at: {
                timestampValue:
                  now,
              },
              question_ids: {
                arrayValue: {
                  values: questionIds.map(
                    (questionId) => ({
                      stringValue:
                        questionId,
                    }),
                  ),
                },
              },
              age_band: {
                stringValue:
                  ageBand,
              },
            },
          },
        },
      ],
      firestoreAccessToken,
    )

    return json({
      ok: true,
      course_id: courseId,
      competition:
        config.competition,
      age_band: ageBand,
      attempt_id: attemptId,
      question_ids: questionIds,
      count: questionIds.length,
    })
  } catch (error) {
    console.error(
      'competition-question-pool error:',
      error,
    )

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      500,
    )
  }
})
