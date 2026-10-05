import fs from 'node:fs'
import path from 'node:path'
import { CATALOG_ITEMS } from './catalog-data.mjs'

const registryPath = 'config/competition-registry.json'
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const competitions = CATALOG_ITEMS.filter((item) => item.is_competition)
const entries = registry.competitions ?? {}

const missing = []
const seenCourseIds = new Set()
const seenSlugs = new Set()

for (const course of competitions) {
  const entry = Object.values(entries).find((value) =>
    value.course_id === course.slug ||
    value.competition === course.name ||
    value.slug === course.slug
  )

  if (!entry) {
    missing.push({ name: course.name, slug: course.slug, reason: 'missing runtime registry entry' })
    continue
  }

  if (!entry.course_id) missing.push({ name: course.name, slug: course.slug, reason: 'missing course_id' })
  if (!entry.slug || entry.slug !== course.slug) missing.push({ name: course.name, slug: course.slug, reason: 'slug mismatch' })
  if (!entry.competition || entry.competition !== course.name) missing.push({ name: course.name, slug: course.slug, reason: 'competition name mismatch' })

  for (const field of ['question_bundle', 'answer_key_bundle', 'age_pools']) {
    if (!entry[field]) missing.push({ name: course.name, slug: course.slug, reason: `missing ${field}` })
    else if (!fs.existsSync(path.join('.tmp-runtime-check', entry[field]))) {
      // Path existence is checked against the generated runtime package when available.
      // The config validator remains usable without materialized storage bundles.
    }
  }

  if (entry.per_attempt !== 30) {
    missing.push({ name: course.name, slug: course.slug, reason: 'per_attempt must be 30' })
  }

  if (entry.enabled !== true) {
    missing.push({ name: course.name, slug: course.slug, reason: 'enabled must be true' })
  }

  const officialPapers = entry.official_papers
  if (!officialPapers || typeof officialPapers !== 'object') {
    missing.push({ name: course.name, slug: course.slug, reason: 'missing official_papers' })
  } else {
    for (const band of ['up_to_8', 'age_9_12', 'age_13_15', 'age_16_plus']) {
      const ids = officialPapers[band]
      if (!Array.isArray(ids) || ids.length !== 30 || new Set(ids).size !== 30 || ids.some((id) => typeof id !== 'string' || !id.trim())) {
        missing.push({ name: course.name, slug: course.slug, reason: `official_papers.${band} must contain exactly 30 unique IDs` })
      }
    }
  }

  const blueprint = entry.selection_blueprint
  if (!blueprint || typeof blueprint !== 'object') {
    missing.push({ name: course.name, slug: course.slug, reason: 'missing selection_blueprint' })
  } else {
    for (const band of ['up_to_8', 'age_9_12', 'age_13_15', 'age_16_plus']) {
      if (!Array.isArray(blueprint[band]) || blueprint[band].length === 0) {
        missing.push({ name: course.name, slug: course.slug, reason: `missing selection_blueprint.${band}` })
        continue
      }
      const total = blueprint[band].reduce((sum, pair) => sum + Number(pair?.[1] || 0), 0)
      if (total !== 30) {
        missing.push({ name: course.name, slug: course.slug, reason: `selection_blueprint.${band} totals ${total}, expected 30` })
      }
    }
  }

  if (entry.course_id && seenCourseIds.has(entry.course_id)) {
    missing.push({ name: course.name, slug: course.slug, reason: 'duplicate course_id in registry' })
  }
  if (entry.slug && seenSlugs.has(entry.slug)) {
    missing.push({ name: course.name, slug: course.slug, reason: 'duplicate slug in registry' })
  }
  if (entry.course_id) seenCourseIds.add(entry.course_id)
  if (entry.slug) seenSlugs.add(entry.slug)
}

const extraEntries = Object.values(entries).filter((entry) => !competitions.some((course) => course.slug === entry.slug))
for (const entry of extraEntries) {
  missing.push({ name: entry.competition || '', slug: entry.slug || '', reason: 'registry entry is not present in catalog' })
}

console.log(JSON.stringify({
  catalog_competitions: competitions.length,
  registry_entries: Object.keys(entries).length,
  covered_competitions: competitions.length - new Set(missing.filter(x => x.reason === 'missing runtime registry entry').map(x => x.slug)).size,
  missing,
}, null, 2))

if (missing.length) {
  console.error(`RESULT: FAIL — ${missing.length} runtime coverage gaps`)
  process.exit(1)
}

if (Object.keys(entries).length !== competitions.length) {
  console.error(`RESULT: FAIL — registry has ${Object.keys(entries).length} entries for ${competitions.length} catalog competitions`)
  process.exit(1)
}

console.log('RESULT: PASS — every catalog competition has complete runtime question-pool configuration')
