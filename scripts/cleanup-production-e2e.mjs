import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!serviceAccountJson) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required.')
const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
const auth = getAuth(app)
const db = getFirestore(app)

const competitionCourseId = 'DNWt3cPE4ZSJG90CTC1e'
const assessmentCourseId = 'tnpsc-group-iv-vao'
const emails = [process.env.E2E_STUDENT_A_EMAIL, process.env.E2E_STUDENT_B_EMAIL].filter(Boolean)

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

if (!emails.length) throw new Error('E2E student email variables are required.')

const studentIds = []
for (const email of emails) {
  try {
    studentIds.push((await auth.getUserByEmail(email)).uid)
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
  }
}

if (supabase && studentIds.length) {
  const { error } = await supabase.from('competition_access_cache')
    .delete()
    .eq('course_id', competitionCourseId)
    .in('student_id', studentIds)
  if (error) throw new Error(`Competition access cache cleanup failed: ${error.message}`)
}

if (studentIds.length) {
  const batch = db.batch()
  for (const studentId of studentIds) {
    batch.delete(db.collection('enrolments').doc(`${studentId}_${competitionCourseId}`))
    batch.delete(db.collection('enrolments').doc(`${studentId}_${assessmentCourseId}`))
  }
  await batch.commit()
}

for (const studentId of studentIds) {
  await Promise.allSettled([
    db.collection('students').doc(studentId).delete(),
    auth.deleteUser(studentId),
  ])
}

console.log(`Safely cleaned ${studentIds.length} isolated production E2E student(s).`)
