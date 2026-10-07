import { randomUUID } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.')
const serviceAccount = JSON.parse(serviceAccountJson)
const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth(app)
const db = getFirestore(app)

const runId = process.env.GITHUB_RUN_ID || randomUUID().replace(/-/g, '').slice(0, 12)
const emailDomain = 'vattams-e2e.test'
const password = `VattamsE2E!${runId}Aa`
const competitionCourseId = 'DNWt3cPE4ZSJG90CTC1e'
const assessmentCourseId = 'tnpsc-group-iv-vao'
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

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
  const studentAEmail = `e2e-student-a-${runId}@${emailDomain}`
  const studentBEmail = `e2e-student-b-${runId}@${emailDomain}`
  const [studentA, studentB] = await Promise.all([
    getOrCreateUser(studentAEmail, 'VATTAMS E2E Student A'),
    getOrCreateUser(studentBEmail, 'VATTAMS E2E Student B'),
  ])
  const now = new Date()
  const batch = db.batch()
  for (const student of [studentA, studentB]) {
    batch.set(db.collection('students').doc(student.uid), {
      id: student.uid, full_name: student.displayName, date_of_birth: '2005-01-01',
      email: student.email, role: 'student', status: 'active', created_at: now.toISOString(),
    }, { merge: true })
    for (const courseId of [competitionCourseId, assessmentCourseId]) {
      batch.set(db.collection('enrolments').doc(`${student.uid}_${courseId}`), {
        student_id: student.uid, course_id: courseId, status: 'active',
        enrolled_at: now.toISOString(), source: 'production-e2e',
      }, { merge: true })
    }
  }
  await batch.commit()
  if (!supabase) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for competition E2E provisioning.')
  const cacheRows = [studentA, studentB].map(student => ({
    student_id: student.uid, course_id: competitionCourseId, is_admin: false,
    enrolment_active: true, date_of_birth: '2005-01-01', checked_at: new Date().toISOString(),
  }))
  const { error: cacheError } = await supabase.from('competition_access_cache')
    .upsert(cacheRows, { onConflict: 'student_id,course_id' })
  if (cacheError) throw new Error(`Competition access cache provisioning failed: ${cacheError.message}`)
  const env = [
    `E2E_STUDENT_A_EMAIL=${studentAEmail}`, `E2E_STUDENT_A_PASSWORD=${password}`,
    `E2E_STUDENT_B_EMAIL=${studentBEmail}`, `E2E_STUDENT_B_PASSWORD=${password}`,
  ].join('\n')
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, env + '\n')
  console.log(`Provisioned production E2E student accounts: ${studentAEmail}, ${studentBEmail}`)
}

async function cleanup() {
  const emails = [process.env.E2E_STUDENT_A_EMAIL, process.env.E2E_STUDENT_B_EMAIL].filter(Boolean)
  if (supabase) {
    const studentIds = []
    for (const email of emails) {
      try { studentIds.push((await auth.getUserByEmail(email)).uid) } catch {}
    }
    if (studentIds.length) {
      const { error } = await supabase.from('competition_access_cache').delete()
        .eq('course_id', competitionCourseId).in('student_id', studentIds)
      if (error) throw new Error(`Competition access cache cleanup failed: ${error.message}`)
    }
    const competitionSnap = await db.collection('enrolments').where('course_id', '==', competitionCourseId).get()
    if (!competitionSnap.empty) {
      const batch = db.batch()
      for (const item of competitionSnap.docs) batch.delete(item.ref)
      await batch.commit()
    }
  }
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email)
      await Promise.allSettled([
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
