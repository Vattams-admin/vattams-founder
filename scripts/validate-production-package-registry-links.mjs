import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const contentRoot = path.join(root, 'content');
const library = readJson(path.join(root, 'config/content-library-registry.json'));
const competitions = readJson(path.join(root, 'config/competition-registry.json')).competitions ?? {};
const assessments = readJson(path.join(root, 'config/assessment-registry.json')).assessments ?? {};
const errors = [];

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name === 'manifest.json') files.push(full);
  }
  return files;
};

const manifests = walk(contentRoot);
const assetValues = (manifest) => {
  const assets = manifest.assets ?? {};
  return [
    ...(assets.studyMaterials ?? []),
    ...(assets.questionBanksPublic ?? []),
    ...(assets.answerKeysPrivate ?? []),
    ...(assets.assessments ?? [])
  ];
};

for (const file of manifests) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const manifest = readJson(file);
  const assets = assetValues(manifest);

  if (!library.domains?.[manifest.domain]) {
    errors.push(relative + ': domain is not registered in content-library-registry');
    continue;
  }

  if (manifest.assets?.manifestPath !== relative) {
    errors.push(relative + ': assets.manifestPath must match manifest location');
  }

  if (manifest.governance?.answerKeyPrivate !== true) {
    errors.push(relative + ': governance.answerKeyPrivate must be true');
  }

  if (manifest.domain === 'competition') {
    const slug = manifest.locator?.competition;
    const target = Object.values(competitions).find((item) => item.slug === slug);
    if (!target) {
      errors.push(relative + ': competition locator does not resolve to competition-registry.json');
      continue;
    }
    if (target.enabled !== true && manifest.status === 'published') {
      errors.push(relative + ': published package targets a disabled competition');
    }
    if (!assets.includes(target.question_bundle)) {
      errors.push(relative + ': missing declared competition question bundle ' + target.question_bundle);
    }
    if (!assets.includes(target.answer_key_bundle)) {
      errors.push(relative + ': missing declared competition answer-key bundle ' + target.answer_key_bundle);
    }
    if (manifest.status === 'published') {
      if ((manifest.coverage?.studyMaterials ?? 0) < 1) errors.push(relative + ': published competition needs study material coverage');
      if ((manifest.coverage?.questions ?? 0) < 1) errors.push(relative + ': published competition needs question coverage');
      if ((manifest.coverage?.assessments ?? 0) < 1) errors.push(relative + ': published competition needs assessment coverage');
    }
  }

  if (manifest.domain === 'competitive-exam') {
    const course = manifest.locator?.course ?? manifest.locator?.exam;
    const targets = Object.values(assessments).filter((item) => item.course_id === course && item.status !== 'retired');
    if (!targets.length) {
      errors.push(relative + ': competitive-exam locator does not resolve to an assessment registry course');
      continue;
    }
    for (const target of targets) {
      if (!assets.includes(target.assessment_id) &&
          !assets.includes(target.question_bank_public) &&
          !assets.includes(target.answer_key)) {
        errors.push(relative + ': missing assessment evidence for ' + target.assessment_id);
      }
    }
  }
}

console.log('Production package registry-link validation passed.');
console.log('Manifests checked:', manifests.length);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
