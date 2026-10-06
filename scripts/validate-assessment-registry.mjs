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
const allowedStatus = new Set(['draft', 'enabled', 'retired'])

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
  if (a.pass_percent != null && (!Number.isFinite(a.pass_percent) || a.pass_percent < 0 || a.pass_percent > 100)) {
    throw new Error(`Assessment ${key}: pass_percent must be 0..100`)
  }
  if (a.section_blueprint != null) {
    if (typeof a.section_blueprint !== 'object' || Array.isArray(a.section_blueprint)) throw new Error(`Assessment ${key}: section_blueprint must be an object`)
    const total = Object.values(a.section_blueprint).reduce((sum, value) => {
      if (!Number.isInteger(value) || value <= 0) throw new Error(`Assessment ${key}: blueprint counts must be positive integers`)
      return sum + value
    }, 0)
    if (total !== a.question_count) throw new Error(`Assessment ${key}: blueprint total ${total} does not equal question_count ${a.question_count}`)
  }

  if (a.status === 'enabled') {
    if (a.domain === 'competition' && a.kind === 'official_attempt') {
      throw new Error(`Assessment ${key}: generic engine cannot replace the existing competition official-attempt runtime`)
    }
    if (a.question_bank_public === a.answer_key) {
      throw new Error(`Assessment ${key}: public bank and private answer key must be separate files`)
    }
  }
}

console.log(`ASSESSMENT REGISTRY VALID: ${Object.keys(registry.assessments).length} definitions`)
