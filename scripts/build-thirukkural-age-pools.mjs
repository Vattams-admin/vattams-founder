import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const questionsPath = path.join(
  root,
  'data/thirukkural/full-bank/objective/questions.objective.public.json',
)

const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'))

const BLUEPRINTS = {
  up_to_8: [
    ['Complete second line', 15],
    ['Identify Paal', 15],
  ],
  age_9_12: [
    ['Complete second line', 5],
    ['Identify Paal', 5],
    ['Complete Kural', 8],
    ['Identify Adhigaram', 3],
    ['Identify Iyal', 3],
    ['Chapter range', 6],
  ],
  age_13_15: [
    ['Complete Kural', 5],
    ['Identify Adhigaram', 5],
    ['Identify Iyal', 4],
    ['Chapter range', 2],
    ['Source meaning identification', 7],
    ['Identify source meaning', 7],
  ],
  age_16_plus: [
    ['Complete Kural', 3],
    ['Identify Adhigaram', 4],
    ['Identify Iyal', 3],
    ['Chapter range', 2],
    ['Source meaning identification', 9],
    ['Identify source meaning', 9],
  ],
}

const requiredSubtopics = new Set(
  Object.values(BLUEPRINTS)
    .flat()
    .map(([subtopic]) => subtopic),
)

const bySubtopic = new Map()

for (const question of questions) {
  if (
    typeof question.question_id !== 'string' ||
    !question.question_id.startsWith('TKR-FULL-')
  ) {
    continue
  }

  if (question.question_type !== 'Multiple Choice') {
    throw new Error(
      `Non-objective question: ${question.question_id}`,
    )
  }

  if (
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    new Set(question.options.map(String)).size !== 4
  ) {
    throw new Error(
      `Invalid options: ${question.question_id}`,
    )
  }

  const subtopic = question.subtopic

  if (!requiredSubtopics.has(subtopic)) continue

  if (!bySubtopic.has(subtopic)) {
    bySubtopic.set(subtopic, [])
  }

  bySubtopic.get(subtopic).push(question.question_id)
}

console.log('===== AGE POOL VALIDATION =====')
console.log('Source objective questions:', questions.length)

for (const subtopic of requiredSubtopics) {
  const ids = bySubtopic.get(subtopic) ?? []

  if (ids.length === 0) {
    throw new Error(`Missing subtopic pool: ${subtopic}`)
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error(`Duplicate IDs in subtopic: ${subtopic}`)
  }

  console.log(`${subtopic}: ${ids.length}`)
}

const agePools = {}

for (const [ageBand, blueprint] of Object.entries(BLUEPRINTS)) {
  agePools[ageBand] = {}

  let requiredTotal = 0

  for (const [subtopic, count] of blueprint) {
    const ids = bySubtopic.get(subtopic) ?? []

    if (ids.length < count) {
      throw new Error(
        `${ageBand}/${subtopic}: need ${count}, have ${ids.length}`,
      )
    }

    agePools[ageBand][subtopic] = ids
    requiredTotal += count
  }

  if (requiredTotal !== 30) {
    throw new Error(
      `${ageBand}: blueprint total is ${requiredTotal}, expected 30`,
    )
  }

  console.log(`${ageBand}: ${requiredTotal} questions/attempt`)
}

const outputPath = path.join(
  root,
  'data/thirukkural/full-bank/objective/age-pools.json',
)

fs.writeFileSync(
  outputPath,
  JSON.stringify(agePools, null, 2),
  'utf8',
)

console.log('\n===== RESULT =====')
console.log('Age pools written:', outputPath)
console.log('Status: PASS')
