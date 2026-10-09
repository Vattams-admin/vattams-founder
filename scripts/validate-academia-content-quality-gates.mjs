#!/usr/bin/env node
/**
 * Cross-pillar, read-only validation runner for VATTAMS Academia.
 *
 * Runs existing validators only. It intentionally excludes seeders, packagers,
 * capture/repair/promote commands, and anything that writes remote data.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const validators = [
  ['Languages', 'scripts/validate-language-learning-seeds.mjs'],
  ['Content package schema', 'scripts/validate-content-package-schema.mjs'],
  ['Content library registry', 'scripts/validate-content-library-registry.mjs'],
  ['Production content coverage', 'scripts/validate-production-content-coverage.mjs'],
  ['Package registry links', 'scripts/validate-production-package-registry-links.mjs'],
  ['Master taxonomy', 'scripts/validate-academia-master-taxonomy.mjs'],
  ['Coverage plan', 'scripts/validate-production-content-coverage-plan.mjs'],
  ['Platform catalogue', 'scripts/validate-complete-platform-catalog.mjs'],
  ['Atomic authoring matrix', 'scripts/validate-atomic-content-authoring-matrix.mjs'],
  ['Authoring backlog', 'scripts/validate-production-authoring-backlog.mjs'],
  ['Syllabus evidence schema', 'scripts/validate-syllabus-evidence-schema.mjs'],
  ['Curriculum authoring control', 'scripts/validate-curriculum-authoring-control.mjs'],
  ['Syllabus artifact registry', 'scripts/validate-syllabus-artifact-registry.mjs'],
  ['Syllabus source intake', 'scripts/validate-syllabus-source-intake.mjs'],
  ['Evidence-to-curriculum links', 'scripts/validate-evidence-to-curriculum-map-link.mjs'],
  ['Curriculum map expansion', 'scripts/validate-curriculum-map-expansion.mjs'],
  ['Evidence-backed curriculum map', 'scripts/validate-evidence-backed-curriculum-map.mjs'],
  ['Curriculum authoring readiness', 'scripts/validate-curriculum-authoring-readiness.mjs'],
  ['Content authoring package', 'scripts/validate-content-authoring-package.mjs'],
  ['Question quality and security', 'scripts/validate-question-quality-security.mjs'],
  ['Assessment selection policy', 'scripts/validate-assessment-selection-policy.mjs'],
  ['Assessment blueprint registry', 'scripts/validate-assessment-blueprint-registry.mjs'],
  ['Assessment blueprint coverage', 'scripts/validate-assessment-blueprint-coverage.mjs'],
  ['Assessment blueprint authoring', 'scripts/validate-assessment-blueprint-authoring.mjs'],
  ['Production question ingestion', 'scripts/validate-production-question-ingestion.mjs'],
  ['Assessment bank registration', 'scripts/validate-assessment-bank-registration.mjs'],
  ['Assessment production readiness', 'scripts/validate-assessment-production-readiness.mjs'],
  ['Assessment publication audit', 'scripts/validate-assessment-publication-audit.mjs'],
  ['Assessment version history', 'scripts/validate-assessment-version-history.mjs'],
  ['Assessment retry policy', 'scripts/validate-assessment-retry-policy.mjs'],
  ['Course content structure', 'scripts/validate-course-content-structure.mjs'],
  ['Thirukkural reference package', 'scripts/validate-thirukkural-production.mjs'],
]

let passed = 0
const failed = []
const startedAt = Date.now()
console.log('VATTAMS Academia cross-pillar content quality gates')
console.log('Scope: existing local validators only; no publish, promotion, seed, repair, or remote-write commands.\n')

for (const [label, relativePath] of validators) {
  const absolutePath = path.join(root, relativePath)
  console.log('\n=== ' + label + ' ===')
  const validatorStartedAt = Date.now()
  const result = spawnSync(process.execPath, [absolutePath], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    timeout: 120_000,
  })
  if (result.error) {
    failed.push({ label, reason: result.error.message })
    console.error('NOT PASSED: ' + label + ' — ' + result.error.message)
    console.error('Duration: ' + ((Date.now() - validatorStartedAt) / 1000).toFixed(1) + 's')
  } else if (result.status !== 0) {
    failed.push({ label, reason: result.signal ? 'terminated by ' + result.signal : 'exit code ' + result.status })
    console.error('NOT PASSED: ' + label + ' — ' + failed[failed.length - 1].reason)
    console.error('Duration: ' + ((Date.now() - validatorStartedAt) / 1000).toFixed(1) + 's')
  } else {
    passed += 1
    console.log('PASSED: ' + label + ' (' + ((Date.now() - validatorStartedAt) / 1000).toFixed(1) + 's)')
  }
}

console.log('\nCross-pillar validation summary: ' + passed + '/' + validators.length + ' passed; ' + failed.length + ' failed.')
console.log('Total duration: ' + ((Date.now() - startedAt) / 1000).toFixed(1) + 's')
if (failed.length) {
  for (const item of failed) console.error('- ' + item.label + ': ' + item.reason)
  process.exitCode = 1
} else {
  console.log('All configured local validation scripts passed.')
}
