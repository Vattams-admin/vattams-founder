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
    const schemaErrors = [];
    const requiredFields = ['packageId', 'version', 'domain', 'locator', 'status', 'coverage', 'assets', 'governance'];
    for (const field of requiredFields) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) schemaErrors.push('missing required field: ' + field);
    }
    if (typeof data.packageId !== 'string' || data.packageId.length < 3) schemaErrors.push('packageId must be a string of at least 3 characters');
    if (typeof data.version !== 'string' || !/^\\d+\\.\\d+\\.\\d+$/.test(data.version)) schemaErrors.push('version must use semantic version format x.y.z');
    if (!['course', 'school', 'competitive-exam', 'entrance-exam', 'professional', 'competition'].includes(data.domain)) schemaErrors.push('domain is not supported by the production manifest schema');
    if (!data.locator || typeof data.locator !== 'object' || Array.isArray(data.locator) || typeof data.locator.language !== 'string' || data.locator.language.length < 2) schemaErrors.push('locator must be an object with a language code');
    if (!['draft', 'in_review', 'approved', 'published', 'retired'].includes(data.status)) schemaErrors.push('status is not supported by the production manifest schema');
    for (const field of ['studyMaterials', 'questions', 'assessments']) {
      const value = field === 'questions' && data.domain === 'course' && data.coverage?.questions === undefined
        ? data.coverage?.questionBank
        : data.coverage?.[field];
      if (!Number.isInteger(value) || value < 0) schemaErrors.push('coverage.' + field + ' must be a non-negative integer');
    }
    if (!Array.isArray(data.governance?.sourceEvidence) ||
        data.governance.sourceEvidence.some((source) => typeof source !== 'string' || source.trim() === '') ||
        !['unreviewed', 'reviewed', 'approved'].includes(data.governance?.reviewStatus) ||
        data.governance?.answerKeyPrivate !== true) {
      schemaErrors.push('governance must include sourceEvidence, a valid reviewStatus, and answerKeyPrivate=true');
    }
    if (data.status === 'published') {
      const publishedAssets = data.assets ?? {};
      const requiredPublishedAssets = data.domain === 'course'
        ? ['authoringPackages']
        : ['questionBanksPublic', 'answerKeysPrivate'];
      for (const field of requiredPublishedAssets) {
        if (!Array.isArray(publishedAssets[field]) || publishedAssets[field].length === 0) {
          schemaErrors.push('published packages require non-empty assets.' + field);
        }
      }
      for (const field of ['studyMaterials', 'questions', 'assessments']) {
        const value = field === 'questions' && data.domain === 'course' && data.coverage?.questions === undefined
          ? data.coverage?.questionBank
          : data.coverage?.[field];
        if (!Number.isInteger(value) || value <= 0) schemaErrors.push('published packages require coverage.' + field + ' greater than zero');
      }
      if (!['reviewed', 'approved'].includes(data.governance?.reviewStatus)) schemaErrors.push('published packages require reviewed or approved governance.reviewStatus');
      for (const field of ['approvedBy', 'approvedAt', 'contentHash']) {
        if (typeof data.governance?.[field] !== 'string' || data.governance[field].trim() === '') {
          schemaErrors.push('published packages require non-empty governance.' + field);
        }
      }
    }
    if (data.locator && typeof data.locator === 'object' && !Array.isArray(data.locator)) {
      for (const field of ['course', 'exam', 'competition', 'subject', 'language', 'board', 'classNumber', 'region']) {
        if (data.locator[field] !== undefined &&
            (typeof data.locator[field] !== 'string' || data.locator[field].trim() === '')) {
          schemaErrors.push('locator.' + field + ' must be a non-empty string when provided');
        }
      }
    }
    const assets = data.assets ?? null;
    if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
      schemaErrors.push('assets must be an object');
    } else {
      for (const field of ['studyMaterials', 'questionBanksPublic', 'answerKeysPrivate', 'assessments', 'authoringPackages', 'moduleMaps']) {
        if (assets[field] !== undefined &&
            (!Array.isArray(assets[field]) || assets[field].some((entry) => typeof entry !== 'string'))) {
          schemaErrors.push('assets.' + field + ' must be an array of strings');
        }
      }
      for (const field of ['manifestPath', 'courseMap']) {
        if (assets[field] !== undefined && typeof assets[field] !== 'string') {
          schemaErrors.push('assets.' + field + ' must be a string when provided');
        }
      }
    }
    const missingAssetPaths = [];
    if (assets?.manifestPath !== undefined) {
      const resolvedManifestPath = resolveRepositoryAsset(assets.manifestPath);
      if (!resolvedManifestPath.valid) {
        missingAssetPaths.push({ field: 'manifestPath', value: assets.manifestPath, reason: resolvedManifestPath.reason });
      } else if (!exists(resolvedManifestPath.resolved)) {
        missingAssetPaths.push({ field: 'manifestPath', value: assets.manifestPath, reason: 'file does not exist in repository' });
      } else if (!resolvedManifestPath.resolved.endsWith(path.join('manifest.json'))) {
        missingAssetPaths.push({ field: 'manifestPath', value: assets.manifestPath, reason: 'manifestPath must reference a manifest.json file' });
      }
    }
    for (const field of ['studyMaterials', 'assessments', 'authoringPackages', 'questionBanksPublic', 'answerKeysPrivate', 'moduleMaps']) {
      const entries = assets?.[field] ?? [];
      if (!Array.isArray(entries)) {
        missingAssetPaths.push({ field, value: entries, reason: 'asset field must be an array' });
        continue;
      }
      const seenAssetPaths = new Set();
      for (const assetPath of entries) {
        if (typeof assetPath === 'string') {
          if (seenAssetPaths.has(assetPath)) {
            missingAssetPaths.push({ field, value: assetPath, reason: 'duplicate asset reference in manifest' });
          }
          seenAssetPaths.add(assetPath);
        }
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
      ...(schemaErrors.length > 0 ? { invalid: true, schemaErrors } : {}),
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

// Discover course targets from the canonical content/courses directory, not from manifests.
// This makes a course with a missing manifest visible as a missing target instead of silently
// disappearing from the coverage denominator.
const coursesRoot = path.join(CONTENT_ROOT, 'courses');
const courseTargets = exists(coursesRoot)
  ? fs.readdirSync(coursesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const slug = entry.name;
        const manifest = manifests.find((item) =>
          item.domain === 'course' && item.locator?.course === slug
        );
        return {
          targetType: 'course',
          id: slug,
          slug,
          title: manifest?.packageId ?? slug,
          enabled: manifest?.status !== 'retired',
          authoringPackages: manifest?.assets?.authoringPackages ?? []
        };
      })
  : [];

// Validate the course-level maps and package cross-links as part of production coverage.
const courseStructureErrors = [];
for (const target of courseTargets) {
  const courseRoot = path.join(coursesRoot, target.slug);
  const manifest = manifests.find((item) =>
    item.domain === 'course' && item.locator?.course === target.slug
  );
  const manifestPath = path.join(courseRoot, 'manifest.json');
  const courseMapPath = path.join(courseRoot, 'course-map.json');
  const moduleMapPath = path.join(courseRoot, 'module-map.json');

  if (!exists(manifestPath)) courseStructureErrors.push(target.slug + ': missing manifest.json');
  if (!exists(courseMapPath)) courseStructureErrors.push(target.slug + ': missing course-map.json');
  if (!exists(moduleMapPath)) courseStructureErrors.push(target.slug + ': missing module-map.json');
  if (!manifest || manifest.invalid) continue;
  if (!exists(courseMapPath) || !exists(moduleMapPath)) continue;

  let courseMap;
  let moduleMap;
  try {
    courseMap = readJson(courseMapPath);
    moduleMap = readJson(moduleMapPath);
  } catch (error) {
    courseStructureErrors.push(target.slug + ': course/module map JSON is invalid (' + error.message + ')');
    continue;
  }

  const modules = Array.isArray(courseMap.modules) ? courseMap.modules : [];
  if (modules.length === 0) courseStructureErrors.push(target.slug + ': course-map must contain at least one module');
  const lessonIds = new Set();
  let expectedModuleSequence = 1;
  for (const module of modules) {
    if (module.sequence !== expectedModuleSequence) {
      courseStructureErrors.push(target.slug + ': course-map module sequence must be contiguous at ' + String(module.moduleId ?? expectedModuleSequence));
    }
    expectedModuleSequence += 1;
    if (!Array.isArray(module.lessons)) {
      courseStructureErrors.push(target.slug + ': module ' + String(module.moduleId ?? '(unknown)') + ' must contain a lessons array');
      continue;
    }
    let expectedLessonSequence = 1;
    for (const lesson of module.lessons) {
      if (typeof lesson.lessonId !== 'string' || lesson.lessonId.length === 0) {
        courseStructureErrors.push(target.slug + ': lesson is missing lessonId');
      } else if (lessonIds.has(lesson.lessonId)) {
        courseStructureErrors.push(target.slug + ': duplicate lessonId ' + lesson.lessonId);
      } else {
        lessonIds.add(lesson.lessonId);
      }
      if (lesson.sequence !== expectedLessonSequence) {
        courseStructureErrors.push(target.slug + ': lesson sequence must be contiguous in module ' + String(module.moduleId ?? '(unknown)'));
      }
      expectedLessonSequence += 1;
      if (typeof lesson.package !== 'string' || lesson.package.trim() === '') {
        courseStructureErrors.push(target.slug + ': lesson ' + String(lesson.lessonId ?? '(unknown)') + ' has no package path');
      } else {
        const resolved = resolveRepositoryAsset(lesson.package);
        if (!resolved.valid || !exists(resolved.resolved)) {
          courseStructureErrors.push(target.slug + ': lesson package missing or unsafe: ' + lesson.package);
        }
      }
    }
  }

  const packagePaths = manifest.assets?.authoringPackages;
  if (!Array.isArray(packagePaths) || packagePaths.length === 0) {
    courseStructureErrors.push(target.slug + ': manifest must reference authoringPackages');
    continue;
  }
  const packageLessonIds = new Set();
  for (const packagePath of packagePaths) {
    const resolved = resolveRepositoryAsset(packagePath);
    if (!resolved.valid || !exists(resolved.resolved)) {
      courseStructureErrors.push(target.slug + ': manifest authoring package missing or unsafe: ' + String(packagePath));
      continue;
    }
    try {
      const pkg = readJson(resolved.resolved);
      if (pkg.locator?.course !== target.slug) {
        courseStructureErrors.push(target.slug + ': authoring package course locator mismatch: ' + packagePath);
      }
      const lessonId = pkg.locator?.lesson;
      if (typeof lessonId !== 'string' || !lessonIds.has(lessonId)) {
        courseStructureErrors.push(target.slug + ': package lesson is absent from course-map: ' + packagePath);
      }
      if (typeof lessonId === 'string') packageLessonIds.add(lessonId);
    } catch (error) {
      courseStructureErrors.push(target.slug + ': authoring package JSON is invalid: ' + packagePath + ' (' + error.message + ')');
    }
  }
  for (const lessonId of lessonIds) {
    if (!packageLessonIds.has(lessonId)) {
      courseStructureErrors.push(target.slug + ': course-map lesson is missing from manifest authoringPackages: ' + lessonId);
    }
  }

  const moduleIds = new Set(modules.map((module) => module.moduleId).filter((id) => typeof id === 'string'));
  const moduleMapModules = Array.isArray(moduleMap.modules) ? moduleMap.modules : [];
  for (const module of moduleMapModules) {
    if (!moduleIds.has(module.moduleId)) {
      courseStructureErrors.push(target.slug + ': module-map references unknown module ' + String(module.moduleId ?? '(unknown)'));
    }
    for (const lessonId of Array.isArray(module.lessons) ? module.lessons : []) {
      if (!lessonIds.has(lessonId)) {
        courseStructureErrors.push(target.slug + ': module-map references unknown lesson ' + String(lessonId));
      }
    }
  }
}

const assessmentTargets = Object.values(assessmentRegistry.assessments ?? {}).map((item) => ({
  targetType: 'assessment',
  domain: item.domain ?? 'assessment',
  id: item.assessment_id,
  courseId: item.course_id,
  title: item.title ?? item.assessment_id,
  kind: item.kind,
  status: item.status,
  enabled: item.status !== 'retired',
  questionBankPublic: item.question_bank_public,
  answerKey: item.answer_key
}));

const registryTargetErrors = [];
const validateUniqueTargets = (label, entries) => {
  const seen = new Map();
  for (const item of entries) {
    const id = item.id ?? item.courseId ?? item.slug;
    if (typeof id !== 'string' || id.trim() === '') {
      registryTargetErrors.push(label + ': target is missing a non-empty identifier');
      continue;
    }
    if (seen.has(id)) {
      registryTargetErrors.push(label + ': duplicate target identifier ' + id);
    } else {
      seen.set(id, item);
    }
  }
};

validateUniqueTargets('course registry', courseTargets);
validateUniqueTargets('competition registry', competitionTargets);
validateUniqueTargets('assessment registry', assessmentTargets);

const hasAllRequiredAssets = (manifest, publicCandidates, privateCandidates) => {
  const assets = manifest?.assets ?? {};
  const publicBanks = new Set(assets.questionBanksPublic ?? []);
  const privateKeys = new Set(assets.answerKeysPrivate ?? []);
  return publicCandidates.length > 0 && privateCandidates.length > 0 &&
    publicCandidates.every((candidate) => publicBanks.has(candidate)) &&
    privateCandidates.every((candidate) => privateKeys.has(candidate));
};

const findManifest = (target) => manifests.find((item) => {
  if (item.invalid) return false;

  if (target.targetType === 'course') {
    if (item.domain !== 'course') return false;
    return item.locator?.course === target.slug && (item.assets?.authoringPackages ?? []).length > 0;
  }

  if (target.targetType === 'competition') {
    if (item.domain !== 'competition' || item.locator?.competition !== target.slug) return false;
    return hasAllRequiredAssets(item, [target.questionBundle].filter(Boolean), [target.answerKeyBundle].filter(Boolean));
  }

  if (item.domain !== 'competitive-exam' ||
      (item.locator?.exam !== target.courseId && item.locator?.course !== target.courseId)) {
    return false;
  }

  return hasAllRequiredAssets(item, [target.questionBankPublic].filter(Boolean), [target.answerKey].filter(Boolean));
});

const targetManifestMatches = new Map();
const targets = [
  ...courseTargets,
  ...competitionTargets,
  ...assessmentTargets
].map((target) => {
  const manifest = findManifest(target);
  if (manifest) {
    const owners = targetManifestMatches.get(manifest.file) ?? [];
    owners.push({ targetType: target.targetType, id: target.id ?? target.courseId ?? target.slug, title: target.title ?? null });
    targetManifestMatches.set(manifest.file, owners);
  }
  const state = manifest?.status ?? 'missing';
  const remediation = state === 'missing'
    ? 'Create a manifest with the correct locator and required assets, then add evidence and review metadata.'
    : state === 'draft'
      ? 'Complete authoring, verify source evidence and private answer-key separation, then submit for review.'
      : state === 'in_review'
        ? 'Resolve reviewer feedback and record the approval decision before publication.'
        : state === 'approved'
          ? 'Verify release readiness and publish only after all production gates pass.'
          : state === 'retired'
            ? 'Confirm retirement is intentional; replace or re-enable the target if it remains in scope.'
            : state === 'published'
              ? 'Maintain version, evidence, and release integrity; no immediate status action required.'
              : 'Inspect manifest and registry alignment.';
  return {
    ...target,
    state,
    remediation,
    packageId: manifest?.packageId ?? null,
    version: manifest?.version ?? null,
    coverage: manifest?.coverage ?? null,
    manifestFile: manifest?.file ?? null
  };
});

const reusedManifestMatches = [...targetManifestMatches.entries()].filter(([, owners]) => owners.length > 1);

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
  competitiveExamTargetCount: assessmentTargets.filter((item) => item.domain === 'competitive-exam').length,
  competitionTargetCount: competitionTargets.length,
  assessmentTargetCount: assessmentTargets.length,
  byTargetType: Object.fromEntries(['course', 'competitive-exam', 'competition', 'assessment'].map((type) => {
    const group = targets.filter((item) => item.targetType === type || (type === 'competitive-exam' && item.domain === type));
    return [type, { total: group.length, missing: group.filter((item) => item.state === 'missing').length, draft: group.filter((item) => item.state === 'draft').length, inReview: group.filter((item) => item.state === 'in_review').length, approved: group.filter((item) => item.state === 'approved').length, published: group.filter((item) => item.state === 'published').length, retired: group.filter((item) => item.state === 'retired').length }];
  }))
};

const report = { version: 1, generatedAt: summary.generatedAt, summary, targets, manifests };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

if (registryTargetErrors.length > 0) {
  console.error('Production content coverage failed: invalid registry targets detected.');
  for (const error of registryTargetErrors) console.error('- ' + error);
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}

if (courseStructureErrors.length > 0) {
  console.error('Production content coverage failed: course structure is incomplete or inconsistent.');
  for (const error of courseStructureErrors) console.error('- ' + error);
  console.error('Coverage report written to reports/production-content-coverage.json');
  process.exit(1);
}

if (summary.invalidManifestCount > 0) {
  console.error('Production content coverage failed: invalid manifest files detected.');
  for (const manifest of manifests.filter((item) => item.invalid)) {
    console.error('- ' + manifest.file);
    for (const error of manifest.schemaErrors ?? []) console.error('  - ' + error);
    if (manifest.error) console.error('  - ' + manifest.error);
  }
  console.error('Coverage report written to reports/production-content-coverage.json');
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

if (reusedManifestMatches.length > 0) {
  console.error('Production content coverage failed: a manifest matches multiple registry targets.');
  for (const [file, owners] of reusedManifestMatches) {
    console.error('- ' + file + ': ' + owners.map((owner) => '[' + owner.targetType + '] ' + (owner.title ?? owner.id ?? 'unnamed target')).join(' <> '));
  }
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
