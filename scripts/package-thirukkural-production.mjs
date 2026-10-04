import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const out = path.join(root, '.tmp-thirukkural-production')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const required = (p) => {
  if (!fs.existsSync(p)) throw new Error(`Missing ${path.relative(root,p)}. Run the Thirukkural build pipeline first.`)
  return readJson(p)
}
const cleanQuestion = (q, courseId) => ({
  question_id: q.question_id,
  course_id: courseId,
  competition: 'Thirukkural Mastery Championship',
  age_band: q.age_band || 'All ages',
  topic: q.topic || '',
  subtopic: q.subtopic || '',
  question: q.question,
  question_type: 'Multiple Choice',
  options: q.options,
  difficulty: q.difficulty || '',
  skill: q.skill || '',
  marks: Number(q.marks) || 1,
  time_seconds: Number(q.time_seconds) || 60,
  language: q.language || 'Tamil',
  review_status: q.review_status || 'reviewed',
})
const cleanKey = (q) => ({
  answer: String(q.answer ?? '').trim(),
  explanation: q.explanation || '',
  correct_option_index: Number.isInteger(q.correct_option_index) ? q.correct_option_index : undefined,
})

const courseId = 'DNWt3cPE4ZSJG90CTC1e'
const slug = 'thirukkural'
const publicBank = required(path.join(root,'data/thirukkural/full-bank/objective/questions.objective.public.json'))
const privateBank = required(path.join(root,'data/thirukkural/full-bank/objective/answer-key.objective.private.json'))
const official = required(path.join(root,'data/thirukkural/full-bank/objective/official-120.objective.json'))
const agePools = required(path.join(root,'data/thirukkural/full-bank/objective/age-pools.json'))

if (publicBank.length !== 9443 || privateBank.length !== 9443 || official.length !== 120) throw new Error('Thirukkural production bundle counts are invalid')
if (publicBank.some(q => q.review_status !== 'reviewed')) throw new Error('Production packaging blocked: all 9443 Mock Test questions must be review_status=reviewed')

const questions = {}
for (const q of publicBank) questions[q.question_id] = cleanQuestion(q, courseId)
for (const q of official) questions[q.question_id] = cleanQuestion(q, courseId)

const keys = {}
for (const k of privateBank) keys[k.question_id] = cleanKey(k)
for (const q of official) keys[q.question_id] = cleanKey(q)

if (Object.keys(questions).length !== 9563 || Object.keys(keys).length !== 9563) throw new Error('Combined production bundle must contain 9563 unique question IDs')

fs.rmSync(out,{recursive:true,force:true})
fs.mkdirSync(path.join(out,'competitions',slug,'objective'),{recursive:true})

fs.writeFileSync(path.join(out,'competitions',slug,'objective','questions.private.json'),JSON.stringify({course_id:courseId,competition:'Thirukkural Mastery Championship',questions},null,2))
fs.writeFileSync(path.join(out,'competitions',slug,'objective','answer-keys.private.json'),JSON.stringify(keys,null,2))
fs.writeFileSync(path.join(out,'competitions',slug,'objective','age-pools.json'),JSON.stringify(agePools,null,2))

const registry = {
  version: 1,
  competitions: {
    [courseId]: {
      course_id: courseId,
      competition: 'Thirukkural Mastery Championship',
      slug,
      question_bundle: `competitions/${slug}/objective/questions.private.json`,
      answer_key_bundle: `competitions/${slug}/objective/answer-keys.private.json`,
      age_pools: `competitions/${slug}/objective/age-pools.json`,
      per_attempt: 30,
      enabled: true,
    },
  },
}
fs.writeFileSync(path.join(out,'registry.json'),JSON.stringify(registry,null,2))

const manifest = {}
function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
for (const p of [
  path.join(out,'registry.json'),
  path.join(out,'competitions',slug,'objective','questions.private.json'),
  path.join(out,'competitions',slug,'objective','answer-keys.private.json'),
  path.join(out,'competitions',slug,'objective','age-pools.json'),
]) manifest[path.relative(out,p)]={sha256:hash(p),bytes:fs.statSync(p).size}
fs.writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({
  competition:'Thirukkural Mastery Championship',
  course_id:courseId,
  slug,
  question_count:9563,
  mock_question_count:9443,
  official_question_count:120,
  per_attempt:30,\n  official_papers: 4,
  files:manifest,
},null,2))

console.log('THIRUKKURAL PRODUCTION PACKAGE READY')
console.log('Output:', path.relative(root,out))
console.log('Combined questions:', Object.keys(questions).length)\nconsole.log('Official papers: 4 x 30')
console.log('Combined answer keys:', Object.keys(keys).length)
