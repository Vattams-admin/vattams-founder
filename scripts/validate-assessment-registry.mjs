#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registryPath = path.resolve(root, process.argv[2] || 'config/assessment-registry.json')
if (!fs.existsSync(registryPath)) throw new Error(`Missing assessment registry: ${registryPath}`)

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
if (registry?.version !== 1 || !registry?.assessments || typeof registry.assessments !== 'object') {
  throw new Error('Assessment registry must use version 1 and contain assessments')
}

const allowedDomains = new Set(['competition', 'competitive-exam', 'tuition'])
const allowedKinds = new Set(['topic_practice', 'sectional_test', 'pyq_test', 'mock_test', 'official_attempt', 'chapter_test', 'subject_test'])
const allowedStatus = new Set(['draft', 'reviewed', 'published', 'retired'])

function readJson(relativePath, label) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) throw new Error(`${label}: path is required`)
  const file = path.resolve(root, relativePath)
  if (!fs.existsSync(file)) throw new Error(`${label}: missing file ${relativePath}`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function validatePublic(q, i, a) {
  const label = `${a.assessment_id}.public[${i}]`
  if (!q || typeof q !== 'object') throw new Error(`${label}: invalid question`)
  if (typeof q.question_id !== 'string' || !q.question_id.trim()) throw new Error(`${label}: question_id required`)
  if (q.course_id !== a.course_id) throw new Error(`${label}: course_id mismatch`)
  if (q.assessment_id !== a.assessment_id) throw new Error(`${label}: assessment_id mismatch`)
  if (typeof q.question !== 'string' || !q.question.trim()) throw new Error(`${label}: question required`)
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(v => typeof v !== 'string' || !v.trim())) {
    throw new Error(`${label}: exactly four non-empty options required`)
  }
  if (new Set(q.options.map(v => v.trim())).size !== 4) throw new Error(`${label}: options must be unique`)
  for (const field of ['correct_option_index', 'explanation', 'answer', 'answer_text', 'correct_answer']) {
    if (Object.prototype.hasOwnProperty.call(q, field)) throw new Error(`${label}: private field ${field} must not exist in public bank`)
  }
  for (const field of ['subject', 'topic', 'subtopic', 'language']) {
    if (typeof q[field] !== 'string' || !q[field].trim()) throw new Error(`${label}: ${field} required`)
  }
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) throw new Error(`${label}: invalid difficulty`)
  if (!Number.isFinite(q.marks) || q.marks <= 0) throw new Error(`${label}: marks must be positive`)
  if (!Number.isFinite(q.time_seconds) || q.time_seconds <= 0) throw new Error(`${label}: time_seconds must be positive`)
}

function validateKey(q, i, a) {
  const label = `${a.assessment_id}.key[${i}]`
  if (!q || typeof q !== 'object') throw new Error(`${label}: invalid answer-key entry`)
  if (typeof q.question_id !== 'string' || !q.question_id.trim()) throw new Error(`${label}: question_id required`)
  if (!Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3) {
    throw new Error(`${label}: correct_option_index must be 0..3`)
  }
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 12) {
    throw new Error(`${label}: explanation must contain at least 12 characters`)
  }
  if (q.review_status !== 'reviewed') throw new Error(`${label}: review_status must be reviewed`)
  if (!Number.isFinite(q.marks) || q.marks <= 0) throw new Error(`${label}: marks must be positive`)
}

let enabledCount = 0
for (const [key, a] of Object.entries(registry.assessments)) {
  if (!a || typeof a !== 'object') throw new Error(`Assessment ${key}: invalid definition`)
  if (a.assessment_id !== key) throw new Error(`Assessment ${key}: assessment_id must match registry key`)
  for (const field of ['course_id', 'slug', 'title', 'question_bank_public', 'answer_key']) {
    if (typeof a[field] !== 'string' || !a[field].trim()) throw new Error(`Assessment ${key}: ${field} is required`)
  }
  if (!allowedDomains.has(a.domain)) throw new Error(`Assessment ${key}: invalid domain`)
  if (!allowedKinds.has(a.kind)) throw new Error(`Assessment ${key}: invalid kind`)
  if (!allowedStatus.has(a.status)) throw new Error(`Assessment ${key}: invalid status`)
  if (!Number.isInteger(a.question_count) || a.question_count <= 0) throw new Error(`Assessment ${key}: question_count must be positive`)
  if (!Number.isInteger(a.time_seconds) || a.time_seconds <= 0) throw new Error(`Assessment ${key}: time_seconds must be positive`)
  if (a.pass_percent != null && (!Number.isFinite(a.pass_percent) || a.pass_percent < 0 || a.pass_percent > 100)) throw new Error(`Assessment ${key}: pass_percent must be 0..100`)
  if (a.section_blueprint != null) {
    if (typeof a.section_blueprint !== 'object' || Array.isArray(a.section_blueprint)) throw new Error(`Assessment ${key}: section_blueprint must be an object`)
    const total = Object.values(a.section_blueprint).reduce((sum, value) => {
      if (!Number.isInteger(value) || value <= 0) throw new Error(`Assessment ${key}: blueprint counts must be positive integers`)
      return sum + value
    }, 0)
    if (total !== a.question_count) throw new Error(`Assessment ${key}: blueprint total ${total} does not equal question_count ${a.question_count}`)
  }

  // Draft/retired definitions may exist without published content. Enabled
  // definitions are never allowed to bypass the content gate.
  if (a.status === 'reviewed' || a.status === 'published') {
    if (a.domain === 'competition' && a.kind === 'official_attempt') {
      throw new Error(`Assessment ${key}: generic engine cannot replace the existing competition official-attempt runtime`)
    }
    if (a.question_bank_public === a.answer_key) throw new Error(`Assessment ${key}: public bank and private answer key must be separate files`)

    const publicBank = readJson(a.question_bank_public, `${key}.question_bank_public`)
    const answerKey = readJson(a.answer_key, `${key}.answer_key`)
    if (!Array.isArray(publicBank) || publicBank.length === 0) throw new Error(`Assessment ${key}: public bank must be a non-empty array`)
    if (!Array.isArray(answerKey) || answerKey.length === 0) throw new Error(`Assessment ${key}: answer key must be a non-empty array`)
    if (a.question_count > publicBank.length) throw new Error(`Assessment ${key}: question_count exceeds public bank size`)
    if (publicBank.length !== answerKey.length) throw new Error(`Assessment ${key}: public bank and answer key counts differ`)

    const publicIds = new Set()
    for (const [i, q] of publicBank.entries()) {
      validatePublic(q, i, a)
      if (publicIds.has(q.question_id)) throw new Error(`Assessment ${key}: duplicate public question_id ${q.question_id}`)
      publicIds.add(q.question_id)
    }
    const keyIds = new Set()
    for (const [i, q] of answerKey.entries()) {
      validateKey(q, i, a)
      if (keyIds.has(q.question_id)) throw new Error(`Assessment ${key}: duplicate answer-key question_id ${q.question_id}`)
      keyIds.add(q.question_id)
      if (!publicIds.has(q.question_id)) throw new Error(`Assessment ${key}: answer key contains unknown question_id ${q.question_id}`)
    }
    for (const id of publicIds) if (!keyIds.has(id)) throw new Error(`Assessment ${key}: missing answer key for question_id ${id}`)
    enabledCount++
  }
}

console.log(`ASSESSMENT REGISTRY VALID: ${Object.keys(registry.assessments).length} definitions, ${enabledCount} reviewed/published`)
