#!/usr/bin/env node
// =====================================================================
//
// Adds every item from academy_course.pdf into the existing `courses`
// Firestore collection (the one Courses.tsx / CourseDetail.tsx /
// AdminCourses.tsx actually read — see src/types/database.ts). Matches
// by slug, never duplicates, never overwrites admin-edited fields, never
// deletes anything.
//
// SETUP (run these yourself — this script is not run automatically):
//   1. npm install firebase-admin dotenv --save-dev
//   2. Get a service account key: Firebase Console → Project settings →
//      Service accounts → Generate new private key. Save it somewhere
//      OUTSIDE the repo, e.g. ~/vattams-service-account.json
//   3. Set the env var (don't commit the key):
//        export GOOGLE_APPLICATION_CREDENTIALS=~/vattams-service-account.json
//      and make sure VITE_FIREBASE_PROJECT_ID is set in .env.local
//      (already required by src/lib/firebase.ts).
//   4. Dry run first:  node scripts/seed-catalog.mjs --dry-run
//   5. Then for real:  node scripts/seed-catalog.mjs
//
// BEHAVIOUR (idempotent — safe to run more than once):
//   - Looks up each catalog item by its stable slug.
//   - If no course with that slug exists: creates it (is_published:
//     true, base_fee from the PDF's sample pricing).
//   - If a course with that slug already exists: only fills in fields
//     that are currently null/empty/undefined (short_description,
//     description, category_id, is_competition). Never touches an
//     existing base_fee, is_published, name, or slug — those stay
//     exactly as an admin already set them.
//   - Never deletes, never touches unrelated collections
//     (course_enrolments, payments, certificates, academy_students,
//     academy_tutors, admin_users, etc. are not read or written).
// =====================================================================

import { existsSync, readFileSync } from 'node:fs'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { CATALOG_ITEMS } from './catalog-data.mjs'

// Minimal .env.local loader (no `dotenv` dependency required) — only
// used to recover VITE_FIREBASE_PROJECT_ID for convenience; explicit
// env vars always win.
function loadDotEnvLocal() {
  const path = new URL('../.env.local', import.meta.url)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, rawValue] = m
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '')
    }
  }
}

loadDotEnvLocal()

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error(
    'Missing project id. Set VITE_FIREBASE_PROJECT_ID in .env.local (same value the app already uses) ' +
      'or FIREBASE_PROJECT_ID as an env var.'
  )
  process.exit(1)
}

const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS ? applicationDefault() : null
if (!credential) {
  console.error(
    'Missing GOOGLE_APPLICATION_CREDENTIALS. Generate a service account key from ' +
      'Firebase Console -> Project settings -> Service accounts, then:\n' +
      '  export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json'
  )
  process.exit(1)
}

initializeApp({ credential, projectId })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

const MISSING_METADATA_FIELDS = ['short_description', 'description', 'category_id', 'is_competition']

function isMissing(value) {
  return value === undefined || value === null || value === ''
}

async function main() {
  const coursesRef = db.collection('courses')

  const beforeSnapshot = await coursesRef.get()
  const existingCountBefore = beforeSnapshot.size

  let inserted = 0
  let updated = 0
  let skippedIdentical = 0
  const byCategory = { 'competitive-exams': 0, 'academic-skill': 0, 'vattams-competitions': 0 }
  const changedFiles = []

  for (const item of CATALOG_ITEMS) {
    const match = await coursesRef.where('slug', '==', item.slug).limit(1).get()

    if (match.empty) {
      byCategory[item.category_id] += 1
      console.log(`${DRY_RUN ? '[dry-run] would insert' : 'inserting'}: ${item.name} (${item.slug})`)
      if (!DRY_RUN) {
        await coursesRef.add({ ...item, created_at: new Date() })
        changedFiles.push(`courses/${item.slug} (new)`)
      }
      inserted += 1
      continue
    }

    byCategory[item.category_id] += 1
    const existingDoc = match.docs[0]
    const existing = existingDoc.data()

    const patch = {}
    for (const field of MISSING_METADATA_FIELDS) {
      if (isMissing(existing[field]) && !isMissing(item[field])) {
        patch[field] = item[field]
      }
    }

    if (Object.keys(patch).length === 0) {
      console.log(`already exists, no missing metadata to fill: ${item.name} (${item.slug})`)
      skippedIdentical += 1
      continue
    }

    console.log(
      `${DRY_RUN ? '[dry-run] would update' : 'updating'}: ${item.name} (${item.slug}) -> filling: ${Object.keys(patch).join(', ')}`
    )
    if (!DRY_RUN) {
      await existingDoc.ref.update(patch)
      changedFiles.push(`courses/${item.slug} (updated: ${Object.keys(patch).join(', ')})`)
    }
    updated += 1
  }

  console.log('\n=== Seed report ===')
  console.log(`Existing courses before: ${existingCountBefore}`)
  console.log(`New courses inserted: ${DRY_RUN ? 0 : inserted}${DRY_RUN ? ` (would insert ${inserted})` : ''}`)
  console.log(`Existing courses updated (missing metadata filled): ${DRY_RUN ? 0 : updated}${DRY_RUN ? ` (would update ${updated})` : ''}`)
  console.log(`Skipped (already complete, no changes needed): ${skippedIdentical}`)
  console.log('Catalog items processed by category:', byCategory)
  console.log(`Total catalog items processed: ${CATALOG_ITEMS.length} (55 unique — see note in scripts/catalog-data.mjs about Spoken English/Public Speaking)`)
  if (DRY_RUN) console.log('\nThis was a DRY RUN — no writes were made. Re-run without --dry-run to apply.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed script failed:', err)
    process.exit(1)
  })
