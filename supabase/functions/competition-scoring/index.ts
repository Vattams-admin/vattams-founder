import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from 'npm:jose@6'

const FIREBASE_PROJECT_ID =
  Deno.env.get('FIREBASE_PROJECT_ID') || ''

const FIREBASE_SERVICE_ACCOUNT_JSON =
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || ''

if (!FIREBASE_PROJECT_ID) {
  throw new Error('Missing FIREBASE_PROJECT_ID')
}

if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON')
}

const serviceAccount =
  JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
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

async function verifyFirebaseUser(token: string) {
  const issuer =
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`

  const { payload } = await jwtVerify(
    token,
    firebaseJWKS,
    {
      issuer,
      audience: FIREBASE_PROJECT_ID,
    }
  )

  if (!payload.sub) {
    throw new Error(
      'Firebase token has no subject'
    )
  }

  return payload.sub
}

async function getGoogleAccessToken() {
  const privateKey = await importPKCS8(
    serviceAccount.private_key,
    'RS256'
  )

  const now =
    Math.floor(Date.now() / 1000)

  const assertion = await new SignJWT({
    scope:
      'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
    })
    .setIssuer(
      serviceAccount.client_email
    )
    .setAudience(
      'https://oauth2.googleapis.com/token'
    )
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
    }
  )

  if (!response.ok) {
    throw new Error(
      'Unable to obtain Firestore service access token'
    )
  }

  const data = await response.json()

  if (!data.access_token) {
    throw new Error(
      'Firestore service access token was not returned'
    )
  }

  return data.access_token as string
}

function firestoreBaseUrl() {
  return (
    'https://firestore.googleapis.com/v1/projects/' +
    `${encodeURIComponent(FIREBASE_PROJECT_ID)}` +
    '/databases/(default)/documents'
  )
}

async function firestoreGet(
  path: string,
  accessToken: string
) {
  const response = await fetch(
    `${firestoreBaseUrl()}/${path}`,
    {
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Firestore GET failed: ${response.status}`
    )
  }

  return await response.json()
}

async function firestoreRunQuery(
  structuredQuery: unknown,
  accessToken: string
) {
  const response = await fetch(
    `${firestoreBaseUrl()}:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        structuredQuery,
      }),
    }
  )

  if (!response.ok) {
    const text =
      await response.text()

    console.error(
      'Firestore query failed:',
      text
    )

    throw new Error(
      `Firestore query failed: ${response.status}`
    )
  }

  return await response.json()
}

async function firestoreCommit(
  writes: unknown[],
  accessToken: string
) {
  const response = await fetch(
    `${firestoreBaseUrl()}:commit`,
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        writes,
      }),
    }
  )

  if (!response.ok) {
    const text =
      await response.text()

    console.error(
      'Firestore commit failed:',
      text
    )

    throw new Error(
      'Unable to save competition result'
    )
  }

  return await response.json()
}

function stringField(
  document: any,
  field: string
) {
  return (
    document?.fields?.[field]?.stringValue ??
    ''
  )
}

function integerField(
  document: any,
  field: string
) {
  return Number(
    document?.fields?.[field]?.integerValue ??
      0
  )
}

function booleanField(
  document: any,
  field: string
) {
  return (
    document?.fields?.[field]?.booleanValue ===
    true
  )
}

function normalizeAnswer(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function isSafeId(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value)
}

function firestoreResource(
  collection: string,
  id: string
) {
  return (
    `projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/` +
    `${collection}/${encodeURIComponent(id)}`
  )
}

type SubmittedAnswer = {
  questionId: string
  answer: string
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
        {
          error:
            'Method not allowed',
        },
        405
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
        401
      )
    }

    const studentId =
      await verifyFirebaseUser(
        firebaseToken
      )

    const body =
      await req.json()

    const attemptId =
      String(
        body.attemptId || ''
      ).trim()

    if (
      !attemptId ||
      !isSafeId(attemptId)
    ) {
      return json(
        {
          error:
            'Valid attemptId is required',
        },
        400
      )
    }

    if (
      !Array.isArray(body.answers)
    ) {
      return json(
        {
          error:
            'answers must be an array',
        },
        400
      )
    }

    if (
      body.answers.length > 600
    ) {
      return json(
        {
          error:
            'Too many answers',
        },
        400
      )
    }

    const submittedAnswers:
      SubmittedAnswer[] =
      body.answers.map(
        (item: any) => ({
          questionId:
            String(
              item?.questionId ||
                ''
            ).trim(),
          answer:
            String(
              item?.answer ?? ''
            ).trim(),
        })
      )

    const answerIds =
      new Set<string>()

    for (
      const item of
      submittedAnswers
    ) {
      if (
        !isSafeId(
          item.questionId
        )
      ) {
        return json(
          {
            error:
              'Invalid question ID',
          },
          400
        )
      }

      if (
        answerIds.has(
          item.questionId
        )
      ) {
        return json(
          {
            error:
              `Duplicate answer for ${item.questionId}`,
          },
          400
        )
      }

      answerIds.add(
        item.questionId
      )
    }

    const accessToken =
      await getGoogleAccessToken()

    const attempt =
      await firestoreGet(
        `competition_attempts/${encodeURIComponent(attemptId)}`,
        accessToken
      )

    if (!attempt?.fields) {
      return json(
        {
          error:
            'Competition attempt not found',
        },
        404
      )
    }

    if (
      stringField(
        attempt,
        'student_id'
      ) !== studentId
    ) {
      return json(
        {
          error:
            'This attempt does not belong to you',
        },
        403
      )
    }

    const attemptStatus =
      stringField(
        attempt,
        'status'
      )

    if (
      attemptStatus !==
      'in_progress'
    ) {
      const existingResult =
        await firestoreGet(
          `competition_results/${encodeURIComponent(
            `${studentId}_${attemptId}`
          )}`,
          accessToken
        )

      if (
        existingResult?.fields
      ) {
        return json({
          ok: true,
          attemptId,
          score:
            integerField(
              existingResult,
              'score'
            ),
          maxScore:
            integerField(
              existingResult,
              'max_score'
            ),
          answeredCount:
            integerField(
              existingResult,
              'answered_count'
            ),
          submitted: true,
          alreadySubmitted:
            true,
        })
      }

      return json(
        {
          error:
            'This competition attempt has already been submitted',
        },
        409
      )
    }

    const courseId =
      stringField(
        attempt,
        'course_id'
      )

    // The production competition runtime has migrated to the dedicated
    // competition-official-* functions. This legacy scorer must not accept
    // newly fabricated Firestore attempts, because those attempts are no
    // longer created by the current participant application.
    if (!booleanField(attempt, 'backend_created')) {
      return json(
        {
          error:
            'This competition scoring endpoint is retired. Please use the current official competition flow.',
        },
        410
      )
    }

    if (
      !courseId ||
      !isSafeId(courseId)
    ) {
      return json(
        {
          error:
            'Competition course is missing',
        },
        500
      )
    }

    const course =
      await firestoreGet(
        `courses/${encodeURIComponent(courseId)}`,
        accessToken
      )

    if (!course?.fields) {
      return json(
        {
          error:
            'Competition course not found',
        },
        404
      )
    }

    if (
      !booleanField(
        course,
        'is_competition'
      ) ||
      !booleanField(
        course,
        'is_published'
      )
    ) {
      return json(
        {
          error:
            'This course is not an active published competition',
        },
        409
      )
    }

    const enrolmentId =
      `${studentId}_${courseId}`

    const enrolment =
      await firestoreGet(
        `enrolments/${encodeURIComponent(
          enrolmentId
        )}`,
        accessToken
      )

    if (
      !enrolment?.fields ||
      stringField(
        enrolment,
        'status'
      ) !== 'active'
    ) {
      return json(
        {
          error:
            'Active enrolment is required',
        },
        403
      )
    }

    const questionIdsValue =
      attempt.fields?.question_ids

    const selectedQuestionIds =
      Array.isArray(
        questionIdsValue?.arrayValue?.values
      )
        ? questionIdsValue.arrayValue.values
            .map(
              (value: any) =>
                value?.stringValue
            )
            .filter(
              (value: unknown): value is string =>
                typeof value === 'string' &&
                value.length > 0
            )
        : []

    if (
      selectedQuestionIds.length !== 30 ||
      new Set(selectedQuestionIds).size !== 30
    ) {
      return json(
        {
          error:
            'Competition attempt has an invalid question set',
        },
        409
      )
    }

    const selectedQuestionSet =
      new Set(selectedQuestionIds)

    // The question IDs saved in the attempt are the server-side
    // source of truth. For Thirukkural, the paper is selected by
    // the authenticated question-pool function and can therefore
    // vary by participant age and random selection.
    if (
      stringField(
        course,
        'name'
      ) === 'Thirukkural Mastery Championship' &&
      selectedQuestionIds.some(
        (questionId) =>
          !questionId.startsWith('TKR-FULL-')
      )
    ) {
      return json(
        {
          error:
            'Thirukkural competition contains an invalid question ID',
        },
        409
      )
    }

    for (
      const submitted of
      submittedAnswers
    ) {
      if (
        !selectedQuestionSet.has(
          submitted.questionId
        )
      ) {
        return json(
          {
            error:
              `Question ${submitted.questionId} does not belong to this attempt`,
          },
          400
        )
      }
    }

    const questionRows =
      await firestoreRunQuery(
        {
          from: [
            {
              collectionId:
                'competition_questions',
            },
          ],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: {
                      fieldPath:
                        'course_id',
                    },
                    op: 'EQUAL',
                    value: {
                      stringValue:
                        courseId,
                    },
                  },
                },
                {
                  fieldFilter: {
                    field: {
                      fieldPath:
                        'is_published',
                    },
                    op: 'EQUAL',
                    value: {
                      booleanValue:
                        true,
                    },
                  },
                },
                {
                  fieldFilter: {
                    field: {
                      fieldPath:
                        '__name__',
                    },
                    op: 'IN',
                    value: {
                      arrayValue: {
                        values:
                          selectedQuestionIds.map(
                            (questionId) => ({
                              referenceValue:
                                `${firestoreBaseUrl()}/competition_questions/${questionId}`,
                            }),
                          ),
                      },
                    },
                  },
                },
              ],
            },
          },
        },
        accessToken
      )

    const questionMap =
      new Map<string, any>()

    for (
      const row of questionRows
    ) {
      const question =
        row.document

      if (
        !question ||
        !booleanField(
          question,
          'is_published'
        )
      ) {
        continue
      }

      const questionId =
        stringField(
          question,
          'question_id'
        )

      if (
        questionId &&
        selectedQuestionSet.has(
          questionId
        )
      ) {
        questionMap.set(
          questionId,
          question
        )
      }
    }

    if (
      questionMap.size !== 30
    ) {
      return json(
        {
          error:
            'One or more questions in this attempt are unavailable',
        },
        409
      )
    }

    let score = 0
    let maxScore = 0
    let answeredCount = 0

    for (
      const questionId of
      selectedQuestionIds
    ) {
      const question =
        questionMap.get(
          questionId
        )

      if (!question) {
        throw new Error(
          `Missing question ${questionId}`
        )
      }

      const marks =
        integerField(
          question,
          'marks'
        )

      maxScore += marks

      const submitted =
        submittedAnswers.find(
          (item) =>
            item.questionId ===
            questionId
        )

      if (
        submitted &&
        submitted.answer !== ''
      ) {
        answeredCount++
      }

      const answerKey =
        await firestoreGet(
          `competition_answer_keys/${encodeURIComponent(
            questionId
          )}`,
          accessToken
        )

      if (!answerKey?.fields) {
        throw new Error(
          `Missing answer key for ${questionId}`
        )
      }

      const correctAnswer =
        stringField(
          answerKey,
          'answer'
        )

      if (
        submitted &&
        normalizeAnswer(
          submitted.answer
        ) ===
          normalizeAnswer(
            correctAnswer
          )
      ) {
        score += marks
      }
    }

    const now =
      new Date().toISOString()

    const resultId =
      `${studentId}_${attemptId}`

    const resultName =
      firestoreResource(
        'competition_results',
        resultId
      )

    const attemptName =
      firestoreResource(
        'competition_attempts',
        attemptId
      )

    if (!attempt.updateTime) {
      throw new Error(
        'Competition attempt has no updateTime'
      )
    }

    const existingResult =
      await firestoreGet(
        `competition_results/${encodeURIComponent(
          resultId
        )}`,
        accessToken
      )

    if (existingResult?.fields) {
      return json({
        ok: true,
        attemptId,
        score:
          integerField(
            existingResult,
            'score'
          ),
        maxScore:
          integerField(
            existingResult,
            'max_score'
          ),
        answeredCount:
          integerField(
            existingResult,
            'answered_count'
          ),
        submitted: true,
        alreadySubmitted:
          true,
      })
    }

    const writes = [
      {
        update: {
          name: resultName,
          fields: {
            student_id: {
              stringValue:
                studentId,
            },
            attempt_id: {
              stringValue:
                attemptId,
            },
            course_id: {
              stringValue:
                courseId,
            },
            score: {
              integerValue:
                String(score),
            },
            max_score: {
              integerValue:
                String(maxScore),
            },
            answered_count: {
              integerValue:
                String(answeredCount),
            },
            submitted_at: {
              timestampValue:
                now,
            },
            scored_at: {
              timestampValue:
                now,
            },
          },
        },
        currentDocument: {
          exists: false,
        },
      },
      {
        update: {
          name: attemptName,
          fields: {
            ...attempt.fields,
            status: {
              stringValue:
                'submitted',
            },
            score: {
              integerValue:
                String(score),
            },
            max_score: {
              integerValue:
                String(maxScore),
            },
            submitted_at: {
              timestampValue:
                now,
            },
            scored_at: {
              timestampValue:
                now,
            },
          },
        },
        currentDocument: {
          updateTime:
            attempt.updateTime,
        },
      },
    ]

    try {
      await firestoreCommit(
        writes,
        accessToken
      )
    } catch (commitError) {
      const committedResult =
        await firestoreGet(
          `competition_results/${encodeURIComponent(
            resultId
          )}`,
          accessToken
        )

      if (
        committedResult?.fields
      ) {
        return json({
          ok: true,
          attemptId,
          score:
            integerField(
              committedResult,
              'score'
            ),
          maxScore:
            integerField(
              committedResult,
              'max_score'
            ),
          answeredCount:
            integerField(
              committedResult,
              'answered_count'
            ),
          submitted: true,
          alreadySubmitted:
            true,
        })
      }

      throw commitError
    }

    return json({
      ok: true,
      attemptId,
      score,
      maxScore,
      answeredCount,
      submitted: true,
    })
  } catch (error) {
    console.error(
      'competition-scoring error:',
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
        {
          error:
            'Invalid authentication token',
        },
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
