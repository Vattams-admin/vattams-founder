import fs from 'node:fs'
import admin from 'firebase-admin'
import { createClient } from '@supabase/supabase-js'

const COURSE_ID = 'DNWt3cPE4ZSJG90CTC1e'
const COURSE_NAME = 'Thirukkural Mastery Championship'
const COURSE_SLUG = 'thirukkural-mastery-championship'
const BUCKET = 'academia-course-materials'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
if (!credentialsPath || !fs.existsSync(credentialsPath)) throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to an existing service-account file')

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))),
})
const db = admin.firestore()
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const errors = []
const check = (condition, message) => {
  if (!condition) errors.push(message)
}

async function storageJson(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error(`Missing storage object ${path}: ${error?.message || 'no data'}`)
  return JSON.parse(await data.text())
}

console.log('=== THIRUKKURAL FULL PRODUCTION AUDIT ===')

const courseSnap = await db.collection('courses').doc(COURSE_ID).get()
check(courseSnap.exists, `Firestore course missing: ${COURSE_ID}`)
const course = courseSnap.exists ? courseSnap.data() : {}
check(course.name === COURSE_NAME, 'Firestore course name mismatch')
check(course.slug === COURSE_SLUG, 'Firestore course slug mismatch')
check(course.is_published === true, 'Firestore course is not published')
check(course.is_competition === true, 'Firestore course is_competition is not true')

const materialsSnap = await db.collection('courses').doc(COURSE_ID).collection('materials')
  .where('is_published', '==', true).get()
console.log('Published study materials:', materialsSnap.size)
check(materialsSnap.size > 0, 'No published Thirukkural study materials found')

const enrolmentsSnap = await db.collection('enrolments')
  .where('course_id', '==', COURSE_ID)
  .where('status', '==', 'active')
  .get()
console.log('Active enrolments:', enrolmentsSnap.size)

const registry = await storageJson('competitions/registry.json')
const entry = registry?.competitions?.[COURSE_ID]
check(!!entry, 'Thirukkural registry entry missing')
check(entry?.enabled === true, 'Thirukkural registry entry is not enabled')
check(entry?.slug === 'thirukkural', 'Registry slug must be thirukkural')
check(entry?.per_attempt === 30, 'Registry per_attempt must be 30')
check(entry?.official_papers && Object.keys(entry.official_papers).length === 4, 'Registry must declare four official age-band papers')
check(entry?.question_bundle === 'competitions/thirukkural/objective/questions.private.json', 'Registry question bundle path mismatch')
check(entry?.answer_key_bundle === 'competitions/thirukkural/objective/answer-keys.private.json', 'Registry answer-key path mismatch')
check(entry?.age_pools === 'competitions/thirukkural/objective/age-pools.json', 'Registry age-pools path mismatch')

const questionBundle = await storageJson('competitions/thirukkural/objective/questions.private.json')
const answerBundle = await storageJson('competitions/thirukkural/objective/answer-keys.private.json')
const agePools = await storageJson('competitions/thirukkural/objective/age-pools.json')

const questions = questionBundle?.questions ?? {}
check(questionBundle?.course_id === COURSE_ID, 'Question bundle course_id mismatch')
check(Object.keys(questions).length === 9563, `Question bundle must contain 9563 questions; found ${Object.keys(questions).length}`)
check(Object.keys(answerBundle).length === 9563, `Answer-key bundle must contain 9563 keys; found ${Object.keys(answerBundle).length}`)

const officialIds = [
  ...Array.from({length:30}, (_,i)=>`TKR-U8-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:30}, (_,i)=>`TKR-A9-12-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:30}, (_,i)=>`TKR-A13-15-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:8}, (_,i)=>`TKR-REC-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:7}, (_,i)=>`TKR-ADH-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:8}, (_,i)=>`TKR-MEAN-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:7}, (_,i)=>`TKR-KNOW-${String(i+1).padStart(2,'0')}`),
]
for (const id of officialIds) {
  const q = questions[id]
  const k = answerBundle[id]
  check(!!q, `Official question missing: ${id}`)
  check(!!k, `Official answer key missing: ${id}`)
  if (q) {
    check(q.course_id === COURSE_ID, `${id}: course mismatch`)
    check(q.question_type === 'Multiple Choice', `${id}: not Multiple Choice`)
    check(typeof q.question === 'string' && q.question.trim(), `${id}: question text missing`)
    check(Array.isArray(q.options) && q.options.length === 4 && new Set(q.options).size === 4, `${id}: options invalid`)
  }
}
check(officialIds.length === 120, 'Four official papers must contain 120 questions')
for (const prefix of ['TKR-U8-','TKR-A9-12-','TKR-A13-15-']) {
  check(Object.keys(questions).filter(id => id.startsWith(prefix)).length === 30, `Official paper ${prefix} must contain 30 questions`)
}

const blueprint = {
  up_to_8: [['Complete second line',15],['Identify Paal',15]],
  age_9_12: [['Complete second line',5],['Identify Paal',5],['Complete Kural',8],['Identify Adhigaram',3],['Identify Iyal',3],['Chapter range',6]],
  age_13_15: [['Complete Kural',5],['Identify Adhigaram',5],['Identify Iyal',4],['Chapter range',2],['Source meaning identification',7],['Identify source meaning',7]],
  age_16_plus: [['Complete Kural',3],['Identify Adhigaram',4],['Identify Iyal',3],['Chapter range',2],['Source meaning identification',9],['Identify source meaning',9]],
}
for (const [band, items] of Object.entries(blueprint)) {
  const pool = agePools?.[band]
  check(!!pool, `Age pool missing: ${band}`)
  if (!pool) continue
  const selected = []
  for (const [topic, count] of items) {
    check(Array.isArray(pool[topic]), `${band}/${topic}: pool missing`)
    if (Array.isArray(pool[topic])) selected.push(...pool[topic].slice(0,count))
  }
  check(selected.length === 30, `${band}: blueprint does not produce 30 questions`)
  check(new Set(selected).size === 30, `${band}: duplicate questions in 30-question selection`)
  for (const id of selected) check(typeof id === 'string' && !!questions[id], `${band}: unknown question ${id}`)
}

for (const table of ['competition_mock_attempts','competition_mock_answers','competition_access_cache','competition_attempts','competition_answers','competition_results']) {
  const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  check(!error, `Postgres table unavailable: ${table}: ${error?.message || ''}`)
  console.log(`${table}: ${count ?? 0} rows`)
}

console.log('Published materials:', materialsSnap.size)
console.log('Active enrolments:', enrolmentsSnap.size)
console.log('Question bundle:', Object.keys(questions).length)
console.log('Answer-key bundle:', Object.keys(answerBundle).length)
console.log('Official papers: 4 x 30')
console.log('Age bands:', Object.keys(blueprint).length)

if (errors.length) {
  console.log('RESULT: FAIL')
  for (const error of errors) console.log('- ' + error)
  process.exit(1)
}

console.log('RESULT: PASS')
