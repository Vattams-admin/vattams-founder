import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = process.cwd()
const fail = (message) => { throw new Error(message) }
const readJson = (file) => {
  if (!fs.existsSync(file)) fail(`Missing required file: ${path.relative(root, file)}`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

const objectivePublicPath = path.join(root, 'data/thirukkural/full-bank/objective/questions.objective.public.json')
const objectivePrivatePath = path.join(root, 'data/thirukkural/full-bank/objective/answer-key.objective.private.json')
const officialPath = path.join(root, 'data/thirukkural/full-bank/objective/official-30.objective.json')
const agePoolsPath = path.join(root, 'data/thirukkural/full-bank/objective/age-pools.json')
const sourcePath = path.join(root, 'data/thirukkural/thirukkural.json')
const detailPath = path.join(root, 'data/thirukkural/detail.json')

const publicQuestions = readJson(objectivePublicPath)
const privateKeys = readJson(objectivePrivatePath)
const official = readJson(officialPath)
const agePools = readJson(agePoolsPath)
const source = readJson(sourcePath)
const detail = readJson(detailPath)

if (!Array.isArray(source.kural) || source.kural.length !== 1330) fail('Source must contain exactly 1330 Kurals')
if (!Array.isArray(publicQuestions) || publicQuestions.length !== 9443) fail(`Objective public bank must contain 9443 questions; found ${publicQuestions.length}`)
if (!Array.isArray(privateKeys) || privateKeys.length !== 9443) fail(`Objective private key bank must contain 9443 keys; found ${privateKeys.length}`)
if (!Array.isArray(official) || official.length !== 30) fail('Official paper must contain exactly 30 questions')

const publicIds = new Set(publicQuestions.map(q => q.question_id))
const privateIds = new Set(privateKeys.map(q => q.question_id))
if (publicIds.size !== 9443 || privateIds.size !== 9443) fail('Objective question IDs must be unique')
for (const id of publicIds) if (!privateIds.has(id)) fail(`Missing private key for ${id}`)

for (const q of publicQuestions) {
  if (q.question_type !== 'Multiple Choice') fail(`${q.question_id}: not Multiple Choice`)
  if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options.map(String)).size !== 4) fail(`${q.question_id}: invalid options`)
  if ('answer' in q || 'correct_answer' in q || 'correct_option_index' in q || 'explanation' in q) fail(`${q.question_id}: public bank leaks answer data`)
  if (q.review_status !== 'draft' && q.review_status !== 'reviewed') fail(`${q.question_id}: invalid review_status`)
}

for (const k of privateKeys) {
  if (typeof k.answer !== 'string' || !k.answer.trim()) fail(`${k.question_id}: empty answer key`)
}

const expectedOfficial = [
  ...Array.from({length:8}, (_,i)=>`TKR-REC-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:7}, (_,i)=>`TKR-ADH-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:8}, (_,i)=>`TKR-MEAN-${String(i+1).padStart(2,'0')}`),
  ...Array.from({length:7}, (_,i)=>`TKR-KNOW-${String(i+1).padStart(2,'0')}`),
]
const officialIds = official.map(q => q.question_id)
if (new Set(officialIds).size !== 30 || expectedOfficial.some(id => !officialIds.includes(id))) fail('Official paper IDs do not exactly match the 30 approved IDs')
for (const q of official) {
  if (q.question_type !== 'Multiple Choice') fail(`${q.question_id}: official question type invalid`)
  if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options.map(String)).size !== 4) fail(`${q.question_id}: official options invalid`)
  if (!q.options.includes(String(q.answer).trim())) fail(`${q.question_id}: official answer not present in options`)
}

const blueprint = {
  up_to_8: [['Complete second line',15],['Identify Paal',15]],
  age_9_12: [['Complete second line',5],['Identify Paal',5],['Complete Kural',8],['Identify Adhigaram',3],['Identify Iyal',3],['Chapter range',6]],
  age_13_15: [['Complete Kural',5],['Identify Adhigaram',5],['Identify Iyal',4],['Chapter range',2],['Source meaning identification',7],['Identify source meaning',7]],
  age_16_plus: [['Complete Kural',3],['Identify Adhigaram',4],['Identify Iyal',3],['Chapter range',2],['Source meaning identification',9],['Identify source meaning',9]],
}
for (const [band, entries] of Object.entries(blueprint)) {
  const pool = agePools?.[band]
  if (!pool) fail(`Missing age pool: ${band}`)
  const ids = []
  for (const [topic, count] of entries) {
    if (!Array.isArray(pool[topic]) || pool[topic].length < count) fail(`${band}/${topic}: insufficient pool`)
    ids.push(...pool[topic].slice(0, count))
  }
  if (ids.length !== 30 || new Set(ids).size !== 30) fail(`${band}: blueprint does not resolve to 30 unique questions`)
  for (const id of ids) if (!publicIds.has(id)) fail(`${band}: unknown question ID ${id}`)
}

const generatedFiles = [objectivePublicPath, objectivePrivatePath, officialPath, agePoolsPath]
console.log('THIRUKKURAL PRODUCTION GATE')
console.log('Source Kurals:', source.kural.length)
console.log('Objective questions:', publicQuestions.length)
console.log('Objective keys:', privateKeys.length)
console.log('Official questions:', official.length)
console.log('Age bands:', Object.keys(blueprint).length)
for (const file of generatedFiles) console.log(path.relative(root, file), sha256(file))
console.log('RESULT: PASS')
