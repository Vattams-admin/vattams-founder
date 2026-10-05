import fs from 'node:fs'
import { CATALOG_ITEMS } from './catalog-data.mjs'

const registryPath = 'config/competition-registry.json'
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const competitions = CATALOG_ITEMS.filter((item) => item.is_competition)
const entries = registry.competitions ?? {}

const missing = []
for (const course of competitions) {
  const entry = Object.values(entries).find((value) => value.course_id === course.slug || value.competition === course.name || value.slug === course.slug)
  if (!entry) {
    missing.push({ name: course.name, slug: course.slug, reason: 'missing runtime registry entry' })
    continue
  }
  for (const field of ['question_bundle', 'answer_key_bundle', 'age_pools']) {
    if (!entry[field]) missing.push({ name: course.name, slug: course.slug, reason: `missing ${field}` })
  }
}

console.log(JSON.stringify({ catalog_competitions: competitions.length, registry_entries: Object.keys(entries).length, missing }, null, 2))
if (missing.length) {
  console.error(`RESULT: FAIL — ${missing.length} runtime coverage gaps`)
  process.exit(1)
}
console.log('RESULT: PASS — every catalog competition has runtime question-pool configuration')
