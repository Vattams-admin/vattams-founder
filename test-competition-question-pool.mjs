import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const env = process.env
const courseId = process.argv[2]

if (!courseId) {
  console.error('Usage: node test-competition-question-pool.mjs <course_id>')
  process.exit(1)
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

const rl = createInterface({ input, output })

try {
  const email = await rl.question('Student email: ')
  const password = await rl.question('Student password: ')

  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  )

  const token = await credential.user.getIdToken()

  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/functions/v1/competition-question-pool`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        course_id: courseId,
      }),
    },
  )

  const body = await response.json()

  console.log(`COURSE ID: ${courseId}`)
  console.log(`HTTP: ${response.status}`)

  if (!response.ok) {
    console.log(
      'FUNCTION ERROR:',
      body.message || body.error || body.code || body,
    )
    process.exitCode = 1
    throw new Error('Authenticated function request failed')
  }

  const ids = Array.isArray(body.question_ids)
    ? body.question_ids
    : []

  const uniqueIds = new Set(ids)

  console.log(`COMPETITION: ${body.competition}`)
  console.log(`AGE BAND: ${body.age_band}`)
  console.log(`QUESTION COUNT: ${ids.length}`)
  console.log(`UNIQUE IDS: ${uniqueIds.size}`)
  console.log(`COUNT FIELD: ${body.count}`)

  const validIds = ids.every(
    (id) => typeof id === 'string' && id.length > 0,
  )

  console.log(
    `VALID QUESTION IDS: ${validIds ? 'PASS' : 'FAIL'}`,
  )

  if (
    response.status !== 200 ||
    ids.length !== 30 ||
    uniqueIds.size !== 30 ||
    body.count !== 30 ||
    !validIds
  ) {
    console.log('RESULT: FAIL')
    process.exitCode = 1
  } else {
    console.log('RESULT: PASS')
  }
} catch (error) {
  console.log(
    'TEST ERROR:',
    error instanceof Error ? error.message : String(error),
  )
  process.exitCode = 1
} finally {
  rl.close()
  await signOut(auth).catch(() => {})
}
