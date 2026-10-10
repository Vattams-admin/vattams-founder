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

  async function removeAttempts(attemptTable, answerTables, resultTable) {
    const { data: attempts, error: attemptsError } = await supabase
      .from(attemptTable).select('id').in('student_id', studentIds)
    if (attemptsError) throw new Error(`Unable to inspect isolated ${attemptTable}: ${attemptsError.message}`)
    const attemptIds = (attempts || []).map((row) => row.id).filter(Boolean)
    if (!attemptIds.length) return
    for (const answerTable of answerTables) {
      const { error: answerError } = await supabase.from(answerTable).delete().in('attempt_id', attemptIds)
      if (answerError) throw new Error(`Unable to clean isolated ${answerTable}: ${answerError.message}`)
    }
    const { error: resultError } = await supabase.from(resultTable).delete().in('attempt_id', attemptIds)
    if (resultError) throw new Error(`Unable to clean isolated ${resultTable}: ${resultError.message}`)
    const { error: deleteAttemptsError } = await supabase.from(attemptTable).delete().in('id', attemptIds)
    if (deleteAttemptsError) throw new Error(`Unable to clean isolated ${attemptTable}: ${deleteAttemptsError.message}`)
  }

  await removeAttempts('competition_mock_attempts', ['competition_mock_answers'], 'competition_mock_results')
  await removeAttempts('competition_attempts', ['competition_answers'], 'competition_results')
  await removeAttempts('assessment_attempts', ['assessment_answers'], 'assessment_results')
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
