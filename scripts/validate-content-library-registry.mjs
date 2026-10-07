import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/content-library-registry.json'), 'utf8'));
const india = JSON.parse(fs.readFileSync(path.join(root, 'config/india-education-registry.json'), 'utf8'));
const assessments = JSON.parse(fs.readFileSync(path.join(root, 'config/assessment-registry.json'), 'utf8'));

const errors = [];
const allowedDomains = new Set(Object.keys(registry.domains));
const indiaDomains = new Set(['school','competitive-exam','entrance-exam','professional','competition']);

if (!registry.library_root || registry.library_root !== 'content') errors.push('library_root must be content');
for (const domain of Object.keys(registry.domains)) {
  if (!indiaDomains.has(domain)) errors.push(`unsupported domain in content library registry: ${domain}`);
  const spec = registry.domains[domain];
  if (!spec.path || !Array.isArray(spec.locator) || !Array.isArray(spec.assessmentModes)) {
    errors.push(`invalid domain specification: ${domain}`);
  }
}

const expectedExamFamilies = new Set(india.exam_families.map(x => x.id));
for (const family of registry.exam_foundation.families) {
  if (!expectedExamFamilies.has(family)) errors.push(`exam family missing from India registry: ${family}`);
}
for (const [id, assessment] of Object.entries(assessments.assessments ?? {})) {
  if (!allowedDomains.has(assessment.domain)) errors.push(`${id}: assessment domain is not supported by content library: ${assessment.domain}`);
  if (!assessment.question_bank_public || !assessment.answer_key) errors.push(`${id}: assessment must declare public and private bundles`);
  if (!Number.isInteger(assessment.question_count) || assessment.question_count < 1) errors.push(`${id}: invalid question_count`);
  if (!Number.isInteger(assessment.time_seconds) || assessment.time_seconds < 1) errors.push(`${id}: invalid time_seconds`);
  if (assessment.status === 'published' && (!assessment.question_bank_public || !assessment.answer_key)) {
    errors.push(`${id}: published assessment missing content bundles`);
  }
}

const school = registry.school_foundation;
const validClasses = new Set(india.classes.map(x => x.number));
for (const n of school.class_numbers) if (!validClasses.has(n)) errors.push(`school class not in India registry: ${n}`);
for (const curriculum of school.national_curricula) {
  if (!india.curriculum_families.some(x => x.id === curriculum)) errors.push(`school curriculum missing from India registry: ${curriculum}`);
}

if (errors.length) {
  console.error('Content library registry validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Content library registry validation passed.');
console.log(`Domains: ${allowedDomains.size} | School classes: ${school.class_numbers.length} | Exam families: ${registry.exam_foundation.families.length} | Assessments checked: ${Object.keys(assessments.assessments ?? {}).length}`);
