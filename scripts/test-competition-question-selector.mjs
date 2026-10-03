import fs from 'node:fs'
import {
  selectThirukkuralQuestions,
  THIRUKKURAL_AGE_BLUEPRINTS,
} from '../src/lib/competitionQuestionSelector.ts'

const questions = JSON.parse(
  fs.readFileSync(
    'data/thirukkural/full-bank/objective/questions.objective.public.json',
    'utf8',
  ),
)

console.log(`Objective bank: ${questions.length}`)

if (questions.length !== 9443) {
  throw new Error(`Expected 9443 questions, got ${questions.length}`)
}

const tests = [
  ['up_to_8', 8001],
  ['age_9_12', 9012],
  ['age_13_15', 1315],
  ['age_16_plus', 1600],
]

for (const [ageBand, seed] of tests) {
  const paper = selectThirukkuralQuestions(
    questions,
    ageBand,
    seed,
  )

  const ids = new Set(paper.map(q => q.question_id))

  console.log(`\n=== ${ageBand} ===`)
  console.log(`TOTAL: ${paper.length}`)
  console.log(`UNIQUE: ${ids.size}`)

  const counts = {}

  for (const q of paper) {
    counts[q.subtopic] = (counts[q.subtopic] || 0) + 1
  }

  console.log('SUBTOPICS:', JSON.stringify(counts))

  for (const [subtopic, expected] of THIRUKKURAL_AGE_BLUEPRINTS[ageBand]) {
    const actual = counts[subtopic] || 0

    if (actual !== expected) {
      throw new Error(
        `${ageBand}: ${subtopic} expected ${expected}, got ${actual}`,
      )
    }
  }

  if (paper.length !== 30) {
    throw new Error(`${ageBand}: expected 30 questions`)
  }

  if (ids.size !== 30) {
    throw new Error(`${ageBand}: duplicate IDs`)
  }

  if (
    paper.some(
      q =>
        q.question_type !== 'Multiple Choice' ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        new Set(q.options.map(String)).size !== 4,
    )
  ) {
    throw new Error(`${ageBand}: invalid objective question`)
  }

  console.log('BLUEPRINT: PASS')
  console.log('OBJECTIVE FORMAT: PASS')
}

console.log('\n=== FINAL ===')
console.log('Reusable selector: PASS')
console.log('All 4 age bands: PASS')
console.log('30 unique questions per paper: PASS')
console.log('Exact blueprint enforcement: PASS')
console.log('4-option objective validation: PASS')
console.log('Firestore writes: 0')
console.log('Production flow changed: 0')
