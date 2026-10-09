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

const resolveRepositoryAsset = (assetPath) => {
  if (typeof assetPath !== 'string' || assetPath.trim() === '') {
    return { valid: false, reason: 'asset path must be a non-empty string' };
  }
  if (path.isAbsolute(assetPath)) {
    return { valid: false, reason: 'absolute paths are not allowed' };
  }
  const resolved = path.resolve(ROOT, assetPath);
  const relative = path.relative(ROOT, resolved);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    return { valid: false, reason: 'path escapes repository root' };
  }
  return { valid: true, resolved, repositoryPath: relative.split(path.sep).join('/') };
};

const manifests = walk(CONTENT_ROOT).map((file) => {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  try {
    const data = readJson(file);
    const assets = data.assets ?? null;
    const missingAssetPaths = [];
    for (const field of ['authoringPackages', 'questionBanksPublic', 'answerKeysPrivate']) {
      const entries = assets?.[field] ?? [];
      if (!Array.isArray(entries)) {
        missingAssetPaths.push({ field, value: entries, reason: 'asset field must be an array' });
        continue;
      }
      for (const assetPath of entries) {
        const resolved = resolveRepositoryAsset(assetPath);
        if (!resolved.valid) {
          missingAssetPaths.push({ field, value: assetPath, reason: resolved.reason });
        } else if (!exists(resolved.resolved)) {
          missingAssetPaths.push({ field, value: assetPath, reason: 'file does not exist in repository' });
        }
      }
    }
    return {
      file: relative,
      packageId: data.packageId ?? null,
      version: data.version ?? null,
      domain: data.domain ?? null,
      locator: data.locator ?? null,
      status: data.status ?? null,
      coverage: data.coverage ?? null,
      governance: data.governance ?? null,
      assets,
      missingAssetPaths
    };
  } catch (error) {
    return { file: relative, invalid: true, error: error.message };
  }
});

const duplicatePackageIds = new Map();
for (const manifest of manifests.filter((item) => !item.invalid && item.packageId)) {
  const files = duplicatePackageIds.get(manifest.packageId) ?? [];
  files.push(manifest.file);
  duplicatePackageIds.set(manifest.packageId, files);
}
const duplicatePackageIdEntries = [...duplicatePackageIds.entries()].filter(([, files]) => files.length > 1);

const locatorOwners = new Map();
for (const manifest of manifests.filter((item) => !item.invalid && item.locator && typeof item.locator === 'object')) {
  const canonicalLocator = JSON.stringify(
    Object.entries(manifest.locator).sort(([left], [right]) => left.localeCompare(right))
  );
  const owners = locatorOwners.get(canonicalLocator) ?? [];
  owners.push({ file: manifest.file, packageId: manifest.packageId ?? '(missing packageId)' });
  locatorOwners.set(canonicalLocator, owners);
}
const duplicateLocatorEntries = [...locatorOwners.entries()].filter(([, owners]) => owners.length > 1);

const competitionTargets = Object.values(competitionRegistry.competitions ?? {}).map((item) => ({
  targetType: 'competition',
  id: item.course_id,
  slug: item.slug,
  title: item.competition,
  // Registry entries are considered enabled unless explicitly disabled; missing flags must not silently skip coverage checks.
  enabled: item.enabled !== false,
  questionBundle: item.question_bundle,
  answerKeyBundle: item.answer_key_bundle
}));

const courseTargets = manifests.filter((item) => item.domain === 'course').map((item) => ({
  targetType: 'course',
  id: item.locator?.course ?? item.packageId,
  slug: item.locator?.course ?? item.packageId,
  title: item.packageId,
  enabled: item.status !== 'retired',
  authoringPackages: item.assets?.authoringPackages ?? []
}));

const assessmentTargets = Object.values(assessmentRegistry.assessments ?? {}).map((item) => ({
  targetType: 'assessment',
  id: item.assessment_id,
  courseId: item.course_id,
  title: item.title ?? item.assessment_id,
  kind: item.kind,
  status: item.status,
  enabled: item.status !== 'retired',
  questionBankPublic: item.question_bank_public,
  answerKey: item.answer_key
}));

const hasAllRequiredAssets = (manifest, candidates) => {
  const assets = manifest?.assets ?? {};
  const values = new Set([
    ...(assets.questionBanksPublic ?? []),
    ...(assets.answerKeysPrivate ?? []),
    ...(assets.assessments ?? [])
  ]);
  return candidates.length > 0 && candidates.every((candidate) => values.has(candidate));
};

const findManifest = (target) => manifests.find((item) => {
  if (item.invalid) return false;

  if (target.targetType === 'course') {
    if (item.domain !== 'course') return false;
    return item.locator?.course === target.slug && (item.assets?.authoringPackages ?? []).length > 0;
  }

  if (target.targetType === 'competition') {
    if (item.domain !== 'competition' || item.locator?.competition !== target.slug) return false;
    return hasAllRequiredAssets(item, [
      target.questionBundle,
      target.answerKeyBundle
    ].filter(Boolean));
  }

  if (item.domain !== 'competitive-exam' ||
      (item.locator?.exam !== target.courseId && item.locator?.course !== target.courseId)) {
    return false;
  }

  return hasAllRequiredAssets(item, [
    target.questionBankPublic,
    target.answerKey
  ].filter(Boolean));
});

const targets = [
  ...courseTargets,
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
  missingAssetPathCount: manifests.reduce((total, manifest) => total + (manifest.missingAssetPaths?.length ?? 0), 0),
  targetCount: targets.length,
  missingCount: count('missing'),
  draftCount: count('draft'),
  inReviewCount: count('in_review'),
  approvedCount: count('approved'),
  publishedCount: count('published'),
  retiredCount: count('retired'),
  courseTargetCount: courseTargets.length,
  competitionTargetCount: competitionTargets.length,
  assessmentTargetCount: assessmentTargets.length
};

const report = { version: 1, generatedAt: summary.generatedAt, summary, targets, manifests };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

if (summary.invalidManifestCount > 0) {
  console.error('Production content coverage failed: invalid manifest files detected.');
  process.exit(1);
}
const manifestsWithMissingAssets = manifests.filter((manifest) => (manifest.missingAssetPaths?.length ?? 0) > 0);
if (manifestsWithMissingAssets.length > 0) {
  console.error('Production content coverage failed: manifest asset paths are invalid or missing from the repository.');
  for (const manifest of manifestsWithMissingAssets) {
    for (const asset of manifest.missingAssetPaths) {
      console.error('- ' + manifest.file + ' [' + asset.field + ']: ' + String(asset.value) + ' (' + asset.reason + ')');
    }
  }
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}

if (duplicatePackageIdEntries.length > 0) {
  console.error('Production content coverage failed: duplicate packageId values detected.');
  for (const [packageId, files] of duplicatePackageIdEntries) {
    console.error('- ' + packageId + ': ' + files.join(', '));
  }
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}
if (duplicateLocatorEntries.length > 0) {
  console.error('Production content coverage failed: duplicate full locator values detected.');
  for (const [, owners] of duplicateLocatorEntries) {
    console.error('- ' + owners.map((owner) => owner.file + ' [' + owner.packageId + ']').join(' <> '));
  }
  console.error('Only exact full-locator duplicates are flagged; shared course-level locators across different lessons remain valid.');
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}

const missingEnabledTargets = targets.filter((target) => target.enabled && target.state === 'missing');
if (missingEnabledTargets.length > 0) {
  console.error('Production content coverage failed: ' + missingEnabledTargets.length + ' enabled target(s) have no matching content manifest.');
  for (const target of missingEnabledTargets) {
    console.error('- [' + target.targetType + '] ' + (target.title ?? target.id ?? target.slug ?? 'unnamed target'));
  }
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));
