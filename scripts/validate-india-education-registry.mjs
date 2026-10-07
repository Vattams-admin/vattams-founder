#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.resolve(root, process.argv[2] || 'config/india-education-registry.json')
const registry = JSON.parse(fs.readFileSync(file, 'utf8'))
const fail = (message) => { throw new Error('INDIA EDUCATION REGISTRY INVALID: ' + message) }

if (registry.version !== 1 || registry.registry_id !== 'vattams-india-education') fail('version/registry_id')
if (registry.scope !== 'pan_india' || registry.country?.code !== 'IN') fail('scope/country')
if (!Array.isArray(registry.classes) || registry.classes.length !== 12) fail('must define Class 1 through Class 12')
for (let i = 1; i <= 12; i++) {
  const c = registry.classes.find(x => x.number === i)
  if (!c || c.id !== 'class_' + i) fail('missing class ' + i)
}
const states = registry.states_and_uts || []
const stateCount = states.filter(x => x.type === 'state').length
const utCount = states.filter(x => x.type === 'union_territory').length
if (stateCount !== 28 || utCount !== 8) fail(`expected 28 states + 8 UTs, found ${stateCount} + ${utCount}`)
if (new Set(states.map(x => x.code)).size !== states.length) fail('duplicate state/UT code')
const languages = registry.languages || []
if (languages.length !== 22) fail(`expected 22 scheduled Indian languages, found ${languages.length}`)
if (!languages.every(x => x.enabled && x.code && x.name && x.script)) fail('every language needs code/name/script and must be enabled')
for (const id of ['cbse','cisce','nios','state_board','matriculation','international']) {
  if (!registry.curriculum_families?.some(x => x.id === id)) fail('missing curriculum ' + id)
}
const dimensions = new Set(registry.content_dimensions || [])
for (const d of ['state_or_ut','curriculum','class','subject','chapter','topic','subtopic','language','age_band','version']) {
  if (!dimensions.has(d)) fail('missing content dimension ' + d)
}
if (registry.question_standard?.objective_mcq?.options !== 4) fail('objective MCQ must have exactly four options')
if (registry.question_standard?.blueprint_controlled_selection !== true) fail('assessment selection must be blueprint controlled')
if (registry.question_standard?.curriculum_eligibility_before_age_filter !== true) fail('curriculum eligibility must precede age filtering')
if (registry.language_policy?.machine_translation_never_auto_publishes !== true) fail('machine translation must never auto-publish')
if (registry.governance?.no_unreviewed_content_in_official_assessment !== true) fail('unreviewed content must be blocked from official assessment')
console.log(`INDIA EDUCATION REGISTRY VALID: 28 states + 8 UTs, 12 classes, 22 Indian scheduled languages, ${registry.curriculum_families.length} curriculum families`)
