import fs from 'node:fs'

const questions = JSON.parse(
  fs.readFileSync(
    'data/thirukkural/full-bank/objective/questions.objective.public.json',
    'utf8'
  )
)

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

function randomShuffle(rows, random) {
  const result = [...rows]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function createSeededRandom(seed) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function selectAgePaper(ageBand, seed) {
  const blueprint = BLUEPRINTS[ageBand]

  if (!blueprint) {
    throw new Error(`Unknown age band: ${ageBand}`)
  }

  const random = createSeededRandom(seed)
  const selected = []

  for (const [subtopic, count] of blueprint) {
    const pool = questions.filter(
      q =>
        q.subtopic === subtopic &&
        q.question_type === 'Multiple Choice' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every(option => String(option).trim() !== '')
    )

    if (pool.length < count) {
      throw new Error(
        `${ageBand}: ${subtopic} has only ${pool.length} valid objective questions; ${count} required`
      )
    }

    selected.push(
      ...randomShuffle(pool, random).slice(0, count)
    )
  }

  const ids = new Set(selected.map(q => q.question_id))

  if (selected.length !== 30) {
    throw new Error(`${ageBand}: expected 30, got ${selected.length}`)
  }

  if (ids.size !== 30) {
    throw new Error(`${ageBand}: duplicate question IDs detected`)
  }

  return randomShuffle(selected, random)
}

console.log(`Loaded objective bank: ${questions.length} questions`)

if (questions.length !== 9443) {
  throw new Error(`Expected 9443 objective questions, got ${questions.length}`)
}

const bands = [
  ['up_to_8', 8001],
  ['age_9_12', 9012],
  ['age_13_15', 1315],
  ['age_16_plus', 1600],
]

for (const [ageBand, seed] of bands) {
  const paper = selectAgePaper(ageBand, seed)

  console.log(`\n=== ${ageBand} ===`)
  console.log(`TOTAL: ${paper.length}`)
  console.log(`UNIQUE: ${new Set(paper.map(q => q.question_id)).size}`)

  const counts = {}

  for (const q of paper) {
    counts[q.subtopic] = (counts[q.subtopic] || 0) + 1
  }

  console.log('SUBTOPICS:', JSON.stringify(counts))

  const invalid = paper.filter(
    q =>
      q.question_type !== 'Multiple Choice' ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      new Set(q.options.map(String)).size !== 4
  )

  if (invalid.length) {
    throw new Error(
      `${ageBand}: ${invalid.length} invalid objective questions`
    )
  }

  console.log('OBJECTIVE FORMAT: PASS')
  console.log(
    'IDS:',
    paper.map(q => q.question_id).join(', ')
  )
}

console.log('\n=== FINAL ===')
console.log('Age-aware selector: PASS')
console.log('4 age bands: PASS')
console.log('30 questions per paper: PASS')
console.log('Exact blueprint enforcement: PASS')
console.log('4-option objective validation: PASS')
console.log('Duplicate prevention: PASS')
console.log('Firestore writes: 0')
console.log('Production files modified: 0')
