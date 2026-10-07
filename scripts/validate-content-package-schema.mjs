#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.resolve(root, process.argv[2] || 'config/content-package.schema.json')
const schema = JSON.parse(fs.readFileSync(file, 'utf8'))
const fail = (m) => { throw new Error('CONTENT PACKAGE SCHEMA INVALID: ' + m) }

if (schema.version !== 2) fail('version must be 2')
const domains = new Set(['school','competitive-exam','entrance-exam','professional','competition'])
const modes = new Set(['practice','topic_test','chapter_test','subject_test','sectional_test','mock_test','official_attempt'])
for (const d of schema.domains || []) if (!domains.has(d)) fail('unknown domain '+d)
for (const m of schema.assessment_modes || []) if (!modes.has(m)) fail('unknown assessment mode '+m)
if (schema.mcq?.options !== 4) fail('MCQ option count must be 4')
if (schema.mcq?.public_fields?.includes('correctOptionIndex') || schema.mcq?.public_fields?.includes('explanation')) fail('public MCQ cannot expose private answer fields')
if (schema.governance?.unreviewed_content_publishable !== false) fail('unreviewed content must not be publishable')
if (schema.governance?.machine_translation_auto_publish !== false) fail('machine translation must not auto-publish')
console.log('CONTENT PACKAGE SCHEMA VALID')

if (!schema.locator_dimensions?.school?.includes('classNumber')) fail('school locator must include classNumber')
for (const domain of ['competitive-exam','entrance-exam','professional']) {
  if (!schema.locator_dimensions?.[domain]?.includes('examFamily') || !schema.locator_dimensions?.[domain]?.includes('course')) fail(domain + ' locator must include examFamily and course')
}
if (!schema.locator_dimensions?.competition?.includes('competition')) fail('competition locator must include competition')
if (!schema.quality?.lesson_required_layers?.includes('objectives')) fail('lesson quality layers are required')
if (!schema.quality?.practice_layers?.includes('higherOrderThinking')) fail('HOTS practice layer is required')
if (!schema.quality?.revision_layers?.includes('weakTopicRevision')) fail('weak-topic revision layer is required')
if (!schema.quality?.official_attempt_public_payload?.includes('options')) fail('official attempt must expose four-option choices')
