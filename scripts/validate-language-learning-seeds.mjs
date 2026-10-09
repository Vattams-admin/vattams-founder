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
if (ids.length === 0) fail('no catalogue rows found')
if (new Set(ids).size !== ids.length) fail('duplicate language IDs')
if (rowIds.some((row) => !row[1].trim() || !row[2].trim() || !row[3].trim())) fail('catalogue row has empty ID/name/native name')
if (!rowIds.some((row) => row[4] === 'India') || !rowIds.some((row) => row[4] === 'Global')) fail('both India and Global groups must be present')

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
if (!seedSource.includes('reviewRequired: !reviewed')) fail('unreviewed content must remain explicitly flagged')
if (!seedSource.includes('writingDirection: RTL_LANGUAGES.has(language.id) ? \'rtl\' : \'ltr\'')) fail('writing direction mapping is missing')

if (process.exitCode) process.exit(process.exitCode)
console.log('LANGUAGE SEEDS VALID')
console.log(`Catalogue languages: ${ids.length}`)
console.log(`India-connected: ${rowIds.filter((row) => row[4] === 'India').length}`)
console.log(`Global: ${rowIds.filter((row) => row[4] === 'Global').length}`)
console.log(`Starter units per language: ${unitIds.length}`)
console.log(`Expected starter lesson seeds: ${ids.length * unitIds.length}`)
