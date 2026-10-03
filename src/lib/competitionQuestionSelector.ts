export type CompetitionAgeBand =
  | 'up_to_8'
  | 'age_9_12'
  | 'age_13_15'
  | 'age_16_plus'

export type CompetitionQuestion = {
  question_id: string
  subtopic?: string
  question_type?: string
  options?: string[]
}

type BlueprintEntry = readonly [subtopic: string, count: number]

export const THIRUKKURAL_AGE_BLUEPRINTS: Record<
  CompetitionAgeBand,
  readonly BlueprintEntry[]
> = {
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

function createRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function isValidObjectiveQuestion(
  question: CompetitionQuestion,
): boolean {
  return (
    question.question_id.startsWith('TKR-FULL-') &&
    question.question_type === 'Multiple Choice' &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    new Set(question.options.map(String)).size === 4 &&
    question.options.every(option => String(option).trim().length > 0)
  )
}

export function selectThirukkuralQuestions(
  questions: readonly CompetitionQuestion[],
  ageBand: CompetitionAgeBand,
  seed = Date.now(),
): CompetitionQuestion[] {
  const blueprint = THIRUKKURAL_AGE_BLUEPRINTS[ageBand]

  if (!blueprint) {
    throw new Error(`Unsupported competition age band: ${ageBand}`)
  }

  const random = createRandom(seed)
  const selected: CompetitionQuestion[] = []

  for (const [subtopic, count] of blueprint) {
    const pool = questions.filter(
      question =>
        question.subtopic === subtopic &&
        isValidObjectiveQuestion(question),
    )

    if (pool.length < count) {
      throw new Error(
        `${ageBand}: ${subtopic} has ${pool.length} valid questions; ${count} required`,
      )
    }

    selected.push(...shuffle(pool, random).slice(0, count))
  }

  const uniqueIds = new Set(
    selected.map(question => question.question_id),
  )

  if (selected.length !== 30) {
    throw new Error(
      `${ageBand}: selector returned ${selected.length} questions; expected 30`,
    )
  }

  if (uniqueIds.size !== 30) {
    throw new Error(
      `${ageBand}: selector returned duplicate question IDs`,
    )
  }

  return shuffle(selected, random)
}
