#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve(process.cwd(), 'config/production-content-coverage-plan.json')
const p = JSON.parse(fs.readFileSync(file, 'utf8'))
const fail = (m) => { throw new Error('PRODUCTION COVERAGE PLAN INVALID: ' + m) }

if (p.version !== 1 || p.registry_id !== 'vattams-production-content-coverage-plan') fail('version/registry_id')
if (p.school?.target_classes?.length !== 12 || p.school.target_classes.join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12') fail('school must cover Class 1-12')
for (const id of ['cbse','cisce','nios','state_board','matriculation','international']) {
  if (!p.school.target_curricula.some(x => x.id === id)) fail('missing school curriculum ' + id)
}
for (const layer of ['lesson_notes','worked_examples','practice_basic','practice_conceptual','practice_application','practice_hots','revision','weak_topic_revision','chapter_test','subject_test','mock_test','official_attempt']) {
  if (!p.school.package_sequence.includes(layer)) fail('missing school package layer ' + layer)
}
for (const family of ['tnpsc','upsc','ssc','banking','railways','defence','state_recruitment']) {
  if (!p.competitive.families.includes(family)) fail('missing competitive family ' + family)
}
for (const family of ['medical','engineering','university','law','design','architecture','agriculture','pharmacy','nursing_allied_health','management','hotel_management','teacher_education','fine_arts_media']) {
  if (!p.entrance.families.includes(family)) fail('missing entrance family ' + family)
}
for (const family of ['accounting_finance','medicine','law','engineering_professional','it_technology','education']) {
  if (!p.professional.families.includes(family)) fail('missing professional family ' + family)
}
if (p.question_bank_standard.mcq_options !== 4) fail('MCQ option count must be four')
if (!p.question_bank_standard.answer_key_private) fail('answer key must be private')
if (!p.question_bank_standard.public_official_attempt_must_not_reveal_answer) fail('official answer leakage protection required')
if (!p.multilingual.translation_is_versioned || p.multilingual.machine_translation_auto_publish) fail('translation governance invalid')
if (!p.governance.publish_requires_approved_content || !p.governance.content_hash_required || !p.governance.audit_record_required) fail('publication governance incomplete')
console.log('PRODUCTION CONTENT COVERAGE PLAN VALID')
