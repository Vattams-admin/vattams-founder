#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const file = path.resolve(root, 'config/academia-master-taxonomy.json')
const r = JSON.parse(fs.readFileSync(file, 'utf8'))
const fail = (m) => { throw new Error('ACADEMIA MASTER TAXONOMY INVALID: ' + m) }

if (r.version !== 1 || r.registry_id !== 'vattams-academia-master-taxonomy') fail('version/registry_id')
if (r.school?.classes?.length !== 12 || r.school.classes.join(',') !== '1,2,3,4,5,6,7,8,9,10,11,12') fail('school must define Class 1 through 12')
for (const id of ['cbse','cisce','nios','state_board','matriculation','international']) {
  if (!r.school.curriculum_families.some(x => x.id === id)) fail('missing curriculum family ' + id)
}
for (const layer of ['lesson_notes','worked_examples','guided_practice','independent_practice','chapter_revision','subject_revision','mock_test','official_assessment','weak_topic_remediation']) {
  if (!r.school.delivery_layers.includes(layer)) fail('missing school delivery layer ' + layer)
}
if (r.school_package_standard.question_standard.options !== 4) fail('MCQs must have exactly four options')
if (r.adaptive_policy.eligibility_order.indexOf('class') < 0 || r.adaptive_policy.eligibility_order.indexOf('age_band') < 0) fail('class and age_band must participate in eligibility')
if (r.adaptive_policy.eligibility_order.indexOf('class') > r.adaptive_policy.eligibility_order.indexOf('age_band')) fail('curriculum/class eligibility must precede age filtering')
if (!r.adaptive_policy.never_reveal_official_answer_during_attempt) fail('official answers must remain hidden during attempt')
if (!r.governance.official_assessment_requires_approved_content) fail('official assessments require approved content')
if (!r.languages || r.languages.source_of_truth !== 'config/india-education-registry.json') fail('language source-of-truth')
const competitive = r.exam_domains?.competitive || []
const entrance = r.exam_domains?.entrance || []
const professional = r.exam_domains?.professional || []
for (const family of ['tnpsc','upsc','ssc','banking','railways','defence','state_recruitment']) if (!competitive.some(x => x.family === family)) fail('missing competitive family ' + family)
for (const family of ['medical','engineering','university','law','design','architecture','agriculture','pharmacy','nursing_allied_health']) if (!entrance.some(x => x.family === family)) fail('missing entrance family ' + family)
for (const family of ['accounting_finance','medicine','law','engineering_professional','it_technology','education']) if (!professional.some(x => x.family === family)) fail('missing professional family ' + family)
if (!professional.find(x => x.family === 'accounting_finance')?.tracks.includes('ca-auditing')) fail('CA Auditing track missing')
if (!r.competitions?.pathway?.includes('official_attempt') || !r.competitions?.pathway?.includes('certificate')) fail('competition pathway incomplete')
console.log('ACADEMIA MASTER TAXONOMY VALID: Class 1-12, pan-India school families, competitive/entrance/professional tracks, multilingual routing, adaptive assessment and governance')
