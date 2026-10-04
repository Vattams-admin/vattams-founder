import { randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.')

const serviceAccount = JSON.parse(serviceAccountJson)
const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)
const db = getFirestore(app)

const runId = process.env.GITHUB_RUN_ID || randomUUID().replace(/-/g, '').slice(0, 12)
const emailDomain = 'vattams-e2e.test'
const password = `VattamsE2E!${runId}Aa`
const courseId = `e2e-live-course-${runId}`

async function getOrCreateUser(email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email)
    return await auth.updateUser(existing.uid, { password, displayName, disabled: false, emailVerified: true })
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    return auth.createUser({ email, password, displayName, emailVerified: true, disabled: false })
  }
}

async function provision() {
  const tutorEmail = `e2e-tutor-${runId}@${emailDomain}`
  const studentAEmail = `e2e-student-a-${runId}@${emailDomain}`
  const studentBEmail = `e2e-student-b-${runId}@${emailDomain}`

  const [tutor, studentA, studentB] = await Promise.all([
    getOrCreateUser(tutorEmail, 'VATTAMS E2E Tutor'),
    getOrCreateUser(studentAEmail, 'VATTAMS E2E Student A'),
    getOrCreateUser(studentBEmail, 'VATTAMS E2E Student B'),
  ])

  const now = new Date()
  const start = new Date(now.getTime() - 60_000)
  const end = new Date(now.getTime() + 2 * 60 * 60_000)
  const sessionRef = db.collection('live_sessions').doc()
  const batch = db.batch()

  batch.set(db.collection('tutors').doc(tutor.uid), {
    id: tutor.uid, full_name: 'VATTAMS E2E Tutor', email: tutorEmail,
    qualification: 'E2E Test Qualification', expertise: 'Live Classroom E2E',
    introduction: 'Automated production smoke-test tutor account.',
    role: 'tutor', status: 'approved', created_at: now.toISOString(),
  }, { merge: true })

  for (const student of [studentA, studentB]) {
    batch.set(db.collection('students').doc(student.uid), {
      id: student.uid, full_name: student.displayName, date_of_birth: '2005-01-01',
      email: student.email, role: 'student', status: 'active', created_at: now.toISOString(),
    }, { merge: true })
    batch.set(db.collection('enrolments').doc(`${student.uid}_${courseId}`), {
      student_id: student.uid, course_id: courseId, status: 'active',
      enrolled_at: now.toISOString(), source: 'production-e2e',
    }, { merge: true })
  }

  batch.set(sessionRef, {
    course_id: courseId, course_name: 'VATTAMS E2E Live Classroom', course_slug: null,
    batch_label: 'Production E2E', tutor_id: tutor.uid, tutor_name: 'VATTAMS E2E Tutor',
    title: 'VATTAMS Production WebRTC E2E', topic: 'Automated live classroom smoke test',
    description: 'Temporary production smoke-test session.', start_time: start.toISOString(),
    end_time: end.toISOString(), meeting_provider: 'external', meeting_url: null,
    recording_url: null, session_notes: 'Temporary automated E2E session.', materials: [],
    status: 'published', cancelled_reason: null, cancelled_at: null,
    reschedule_history: [], created_by: tutor.uid, created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })

  await batch.commit()

  const env = [
    `E2E_TUTOR_EMAIL=${tutorEmail}`, `E2E_TUTOR_PASSWORD=${password}`,
    `E2E_STUDENT_A_EMAIL=${studentAEmail}`, `E2E_STUDENT_A_PASSWORD=${password}`,
    `E2E_STUDENT_B_EMAIL=${studentBEmail}`, `E2E_STUDENT_B_PASSWORD=${password}`,
    `E2E_SESSION_ID=${sessionRef.id}`, `E2E_COURSE_ID=${courseId}`,
  ].join('\n')

  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, env + '\n')
  console.log(`Provisioned production E2E session ${sessionRef.id}`)
  console.log(`E2E accounts: ${tutorEmail}, ${studentAEmail}, ${studentBEmail}`)
}

async function cleanup() {
  const sessionId = process.env.E2E_SESSION_ID
  const courseId = process.env.E2E_COURSE_ID
  const emails = [
    process.env.E2E_TUTOR_EMAIL,
    process.env.E2E_STUDENT_A_EMAIL,
    process.env.E2E_STUDENT_B_EMAIL,
  ].filter(Boolean)

  if (sessionId) {
    await db.recursiveDelete(db.collection('live_rooms').doc(sessionId))
    await db.collection('live_sessions').doc(sessionId).delete()
  }

  if (courseId) {
    const snap = await db.collection('enrolments').where('course_id', '==', courseId).get()
    if (!snap.empty) {
      const batch = db.batch()
      for (const item of snap.docs) batch.delete(item.ref)
      await batch.commit()
    }
  }

  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email)
      await Promise.allSettled([
        db.collection('tutors').doc(user.uid).delete(),
        db.collection('students').doc(user.uid).delete(),
        auth.deleteUser(user.uid),
      ])
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
    }
  }
  console.log('Cleaned up production E2E data.')
}

if (process.argv.includes('--cleanup')) await cleanup()
else await provision()
