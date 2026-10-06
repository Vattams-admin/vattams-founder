#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : ''
}

const bankPath = arg('--bank')
const expectedCourseId = arg('--course-id')
const expectedAssessmentId = arg('--assessment-id')

if (!bankPath || !expectedCourseId || !expectedAssessmentId) {
  throw new Error(
    'Usage: node scripts/validate-assessment-bank.mjs --bank <path> --course-id <id> --assessment-id <id>',
  )
}

const absolute = path.resolve(root, bankPath)
if (!fs.existsSync(absolute)) throw new Error(`Missing question bank: ${bankPath}`)

const bank = JSON.parse(fs.readFileSync(absolute, 'utf8'))
if (!Array.isArray(bank) || bank.length === 0) {
  throw new Error('Assessment question bank must be a non-empty array')
}

const ids = new Set()

for (const [index, q] of bank.entries()) {
  const label = `question[${index}]`

  if (!q || typeof q !== 'object') throw new Error(`${label}: invalid question object`)
  if (typeof q.question_id !== 'string' || !q.question_id.trim()) throw new Error(`${label}: question_id is required`)
  if (ids.has(q.question_id)) throw new Error(`${label}: duplicate question_id ${q.question_id}`)
  ids.add(q.question_id)

  if (q.course_id !== expectedCourseId) throw new Error(`${label}: course_id mismatch`)
  if (q.assessment_id !== expectedAssessmentId) throw new Error(`${label}: assessment_id mismatch`)
  if (typeof q.question !== 'string' || !q.question.trim()) throw new Error(`${label}: question is required`)

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`${label}: exactly four options are required`)
  }
  if (q.options.some((option) => typeof option !== 'string' || !option.trim())) {
    throw new Error(`${label}: all options must be non-empty strings`)
  }
  if (new Set(q.options.map((option) => option.trim())).size !== 4) {
    throw new Error(`${label}: options must be unique`)
  }

  if (!Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3) {
    throw new Error(`${label}: correct_option_index must be 0..3`)
  }
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 12) {
    throw new Error(`${label}: explanation must contain at least 12 characters`)
  }

  for (const field of ['subject', 'topic', 'subtopic', 'language']) {
    if (typeof q[field] !== 'string' || !q[field].trim()) {
      throw new Error(`${label}: ${field} is required`)
    }
  }

  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) {
    throw new Error(`${label}: difficulty must be easy, medium or hard`)
  }
  if (!Number.isFinite(q.marks) || q.marks <= 0) throw new Error(`${label}: marks must be positive`)
  if (!Number.isFinite(q.time_seconds) || q.time_seconds <= 0) {
    throw new Error(`${label}: time_seconds must be positive`)
  }
  if (q.review_status !== 'reviewed') {
    throw new Error(`${label}: review_status must be reviewed`)
  }
}

console.log(`ASSESSMENT BANK VALID: ${expectedAssessmentId}`)
console.log(`Questions: ${bank.length}`)
console.log(`Course: ${expectedCourseId}`)
