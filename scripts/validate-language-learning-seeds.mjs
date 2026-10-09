#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registryPath = path.resolve(root, 'src/lib/globalLanguages.ts')
const seedsPath = path.resolve(root, 'src/lib/languageLearningSeeds.ts')
const registrySource = fs.readFileSync(registryPath, 'utf8')
const seedSource = fs.readFileSync(seedsPath, 'utf8')
const fail = (message) => {
  console.error('LANGUAGE SEEDS INVALID: ' + message)
  process.exitCode = 1
}

const rowsMatch = registrySource.match(/const rows: Array<\[string, string, string, LanguageGroup\]> = \[([\s\S]*?)\n\]/)
if (!rowsMatch) {
  fail('could not locate the language catalogue rows')
  process.exit()
}
const rowIds = [...rowsMatch[1].matchAll(/\['([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'(India|Global)'\]/g)]
const ids = rowIds.map((row) => row[1])
const declaredRowCount = (rowsMatch[1].match(/\['/g) ?? []).length
if (declaredRowCount !== rowIds.length) fail(`could not parse every catalogue row (${rowIds.length} parsed of ${declaredRowCount} declared)`)
const languageNames = rowIds.map((row) => row[2].trim().toLocaleLowerCase())
if (new Set(languageNames).size !== languageNames.length) fail('duplicate English language names; review aliases and canonical labels')
if (ids.length === 0) fail('no catalogue rows found')
if (new Set(ids).size !== ids.length) fail('duplicate language IDs')
if (rowIds.some((row) => !row[1].trim() || !row[2].trim() || !row[3].trim())) fail('catalogue row has empty ID/name/native name')
if (!rowIds.some((row) => row[4] === 'India') || !rowIds.some((row) => row[4] === 'Global')) fail('both India and Global groups must be present')

const overridesMatch = seedSource.match(/const SCRIPT_OVERRIDES: Record<string, LanguageScriptFamily> = \{([\s\S]*?)\n\}/)
if (!overridesMatch) {
  fail('could not locate script-family overrides')
  process.exit()
}
const scriptIds = [...overridesMatch[1].matchAll(/(?:^|[,\n])\s*([a-z][a-z0-9-]*):\s*'/g)].map((match) => match[1])
const scriptIdSet = new Set(scriptIds)
if (scriptIdSet.size !== scriptIds.length) fail('duplicate script-family override IDs')
for (const id of scriptIds) {
  if (!ids.includes(id)) fail('script-family override references unknown language: ' + id)
}
for (const id of ['ta', 'te', 'kn', 'ml', 'hi', 'bn', 'gu', 'pa', 'or', 'ar', 'ur', 'he', 'zh', 'ja', 'ko', 'th', 'lo', 'km', 'my', 'bo', 'am', 'ka', 'hy', 'el', 'ru', 'uk', 'bg', 'be', 'kk', 'ky']) {
  if (ids.includes(id) && !scriptIdSet.has(id)) fail('missing explicit script-family override for ' + id)
}
const rtlMatch = seedSource.match(/const RTL_LANGUAGES = new Set\(\[([^\]]*)\]\)/)
if (!rtlMatch) fail('RTL language registry is missing')
else {
  const rtlIds = [...rtlMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
  for (const id of rtlIds) {
    if (!ids.includes(id)) fail('RTL language is not in catalogue: ' + id)
    if (!scriptIdSet.has(id)) fail('RTL language needs explicit script metadata: ' + id)
  }
}

const unitsMatch = seedSource.match(/const STARTER_UNITS = \[([\s\S]*?)\n\] as const/)
if (!unitsMatch) {
  fail('could not locate starter curriculum units')
  process.exit()
}
const unitIds = [...unitsMatch[1].matchAll(/unit:\s*'([^']+)'/g)].map((match) => match[1])
if (unitIds.length !== 5) fail(`expected 5 starter units, found ${unitIds.length}`)
if (new Set(unitIds).size !== unitIds.length) fail('duplicate starter unit IDs')
if (!seedSource.includes('LANGUAGE_DATABASE_SEEDS: readonly LanguageDatabaseSeed[]')) fail('database seed export is missing')
if (!seedSource.includes('LANGUAGE_LEARNING_STARTER_SEEDS: readonly LanguageStarterItem[]')) fail('learning starter seed export is missing')
if (!seedSource.includes('LANGUAGE_DATABASE_SEEDS.flatMap((language) =>')) fail('starter lessons must be generated for every database seed language')
if (!seedSource.includes('STARTER_UNITS.map((unit) =>')) fail('starter lessons must be generated from the shared starter-unit registry')
if (!seedSource.includes('id: `\u0024{language.id}:\u0024{unit.unit}:v1`')) fail('starter lesson IDs must include language, unit, and version')
if (!seedSource.includes('languageId: language.id')) fail('starter lessons must retain their language ID')
if (!seedSource.includes("readiness: reviewed ? 'starter-reviewed' : 'scaffold-localization-needed'")) fail('starter lesson readiness must reflect localized example availability')
if (!seedSource.includes('reviewRequired: !reviewed')) fail('unreviewed content must remain explicitly flagged')
if (!seedSource.includes('writingDirection: RTL_LANGUAGES.has(language.id) ? \'rtl\' : \'ltr\'')) fail('writing direction mapping is missing')
const examplesMatch = seedSource.match(/const REVIEWED_EXAMPLES: Record<string, Record<string, \{ text: string; meaning: string \}>> = \{([\s\S]*?)\n\}/)
if (!examplesMatch) fail('reviewed example registry is missing')
else {
  const examplesBody = examplesMatch[1]
  const exampleLanguageIds = [...examplesBody.matchAll(/^  '([^']+)':\s*\{$/gm)].map((match) => match[1])
  for (const id of exampleLanguageIds) {
    if (!ids.includes(id)) fail('reviewed examples reference unknown language: ' + id)
  }
  const exampleUnits = [...examplesBody.matchAll(/^\s*'([^']+)':\s*\{\s*text:\s*'([^']*)',\s*meaning:\s*'([^']*)'\s*\}/gm)]
  const exampleKeys = exampleUnits.map(([, unit]) => unit)
  if (new Set(exampleKeys).size !== exampleKeys.length) fail('duplicate localized example unit IDs within a language')
  for (const [, unit, sampleText, meaning] of exampleUnits) {
    if (!unitIds.includes(unit)) fail('reviewed example references unknown starter unit: ' + unit)
    if (!sampleText.trim() || !meaning.trim()) fail('reviewed example has empty sample text or meaning')
  }
  if (exampleUnits.length === 0) fail('no reviewed localized examples found')
  console.log(`Localized example entries: ${exampleUnits.length}`)
  console.log(`Languages with example blocks: ${exampleLanguageIds.length}`)
}

if (process.exitCode) process.exit(process.exitCode)
console.log('LANGUAGE SEEDS VALID')
console.log(`Catalogue languages: ${ids.length}`)
console.log(`India-connected: ${rowIds.filter((row) => row[4] === 'India').length}`)
console.log(`Global: ${rowIds.filter((row) => row[4] === 'Global').length}`)
console.log(`Starter units per language: ${unitIds.length}`)
console.log(`Expected starter lesson seeds: ${ids.length * unitIds.length}`)
