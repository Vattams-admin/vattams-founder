import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'reports', 'production-content-coverage.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = (file) => fs.existsSync(file);
const walk = (dir) => {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name === 'manifest.json') out.push(full);
  }
  return out;
};

const registry = readJson(path.join(ROOT, 'config/content-library-registry.json'));
const competitionRegistry = readJson(path.join(ROOT, 'config/competition-registry.json'));
const assessmentRegistry = readJson(path.join(ROOT, 'config/assessment-registry.json'));

const manifests = walk(CONTENT_ROOT).map((file) => {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  try {
    const data = readJson(file);
    return {
      file: relative,
      packageId: data.packageId ?? null,
      version: data.version ?? null,
      domain: data.domain ?? null,
      locator: data.locator ?? null,
      status: data.status ?? null,
      coverage: data.coverage ?? null,
      governance: data.governance ?? null,
      assets: data.assets ?? null
    };
  } catch (error) {
    return { file: relative, invalid: true, error: error.message };
  }
});

const competitionTargets = Object.values(competitionRegistry.competitions ?? {}).map((item) => ({
  targetType: 'competition',
  id: item.course_id,
  slug: item.slug,
  title: item.competition,
  enabled: item.enabled === true
}));

const assessmentTargets = Object.values(assessmentRegistry.assessments ?? {}).map((item) => ({
  targetType: 'assessment',
  id: item.assessment_id,
  courseId: item.course_id,
  title: item.title ?? item.assessment_id,
  kind: item.kind,
  status: item.status,
  enabled: item.status !== 'retired'
}));

const findManifest = (target) => manifests.find((item) => {
  if (item.invalid) return false;
  if (target.targetType === 'competition') {
    return item.domain === 'competition' && item.locator?.competition === target.slug;
  }
  return item.domain === 'competitive-exam' &&
    (item.locator?.exam === target.courseId || item.locator?.course === target.courseId);
});

const targets = [
  ...competitionTargets,
  ...assessmentTargets
].map((target) => {
  const manifest = findManifest(target);
  return {
    ...target,
    state: manifest?.status ?? 'missing',
    packageId: manifest?.packageId ?? null,
    version: manifest?.version ?? null,
    coverage: manifest?.coverage ?? null,
    manifestFile: manifest?.file ?? null
  };
});

const count = (state) => targets.filter((item) => item.state === state).length;
const summary = {
  generatedAt: new Date().toISOString(),
  registryId: registry.registry_id,
  contentRoot: registry.library_root,
  actualManifestCount: manifests.length,
  invalidManifestCount: manifests.filter((m) => m.invalid).length,
  targetCount: targets.length,
  missingCount: count('missing'),
  draftCount: count('draft'),
  inReviewCount: count('in_review'),
  approvedCount: count('approved'),
  publishedCount: count('published'),
  retiredCount: count('retired')
};

const report = { version: 1, generatedAt: summary.generatedAt, summary, targets, manifests };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

if (summary.invalidManifestCount > 0) {
  console.error('Production content coverage failed: invalid manifest files detected.');
  process.exit(1);
}
console.log(JSON.stringify(summary, null, 2));
