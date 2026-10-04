import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "./catalog-data.mjs";

const root = path.resolve("content/competition-study-materials/authored-v2");
const catalog = CATALOG_ITEMS.filter(x => x.category_id === CATEGORY.VATTAMS_COMPETITIONS).map(x => x.name);

const slug = name => name.toLowerCase()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const failures = [];
const warnings = [];
const requiredTop = ["schema_version", "course", "model", "status", "age_bands", "learning_paths", "domains"];

for (const name of catalog) {
  const file = path.join(root, slug(name) + "-core.json");
  if (!fs.existsSync(file)) {
    failures.push(`${name}: missing file`);
    continue;
  }

  let data;
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { failures.push(`${name}: invalid JSON`); continue; }

  for (const key of requiredTop) {
    if (!(key in data)) failures.push(`${name}: missing ${key}`);
  }

  if (data.course !== name) failures.push(`${name}: course name mismatch`);
  if (data.model !== "thirukkural_mastery_reference") failures.push(`${name}: wrong reference model`);
  if (!Array.isArray(data.age_bands) || data.age_bands.length < 4)
    failures.push(`${name}: age bands incomplete`);
  if (!Array.isArray(data.learning_paths) || data.learning_paths.length < 3)
    failures.push(`${name}: learning paths incomplete`);
  if (!Array.isArray(data.domains) || data.domains.length < 6)
    failures.push(`${name}: fewer than 6 domains`);

  const domains = data.domains ?? [];
  const titles = new Set();
  let subtopicCount = 0;
  let subjectSpecificCount = 0;
  let genericCount = 0;

  for (const d of domains) {
    if (!d.name) failures.push(`${name}: domain missing name`);
    if (titles.has(d.name)) failures.push(`${name}: duplicate domain ${d.name}`);
    titles.add(d.name);

    if (!Array.isArray(d.subtopics) || d.subtopics.length < 5)
      failures.push(`${name}/${d.name}: fewer than 5 subtopics`);

    for (const s of d.subtopics ?? []) {
      subtopicCount++;
      const text = JSON.stringify(s);

      if (Array.isArray(s)) {
        if (s.length < 5) failures.push(`${name}/${d.name}: malformed array subtopic`);
        if ((s[1] ?? "").length < 50) warnings.push(`${name}/${d.name}: short teaching content`);
        if ((s[2] ?? "").length < 30) warnings.push(`${name}/${d.name}: short example`);
      } else if (s && typeof s === "object") {
        for (const key of ["title", "teaching", "worked_example", "pitfall", "mastery"]) {
          if (!s[key]) failures.push(`${name}/${d.name}: subtopic missing ${key}`);
        }
        if ((s.teaching ?? "").length < 80) warnings.push(`${name}/${d.name}/${s.title}: short teaching`);
      } else {
        failures.push(`${name}/${d.name}: invalid subtopic shape`);
      }

      const genericMarkers = [
        "Master ",
        "representative ",
        "key rule, clue, language feature or performance criterion",
        "core terminology, observable or textual features",
        "verify the final result against the stated criteria"
      ];
      const hits = genericMarkers.filter(m => text.includes(m)).length;
      if (hits >= 2) genericCount++; else subjectSpecificCount++;
    }
  }

  if (subtopicCount < 30) failures.push(`${name}: fewer than 30 subtopics`);
  if (genericCount > 0) {
    warnings.push(`${name}: ${genericCount}/${subtopicCount} subtopics contain generic scaffold language`);
  }
  if (subjectSpecificCount < Math.max(10, Math.ceil(subtopicCount * 0.25))) {
    failures.push(`${name}: insufficient subject-specific authored depth (${subjectSpecificCount}/${subtopicCount})`);
  }
}

const expectedFiles = new Set(catalog.map(n => slug(n) + "-core.json"));
for (const file of fs.readdirSync(root).filter(f => f.endsWith(".json"))) {
  if (!expectedFiles.has(file)) warnings.push(`unmatched authored-v2 file: ${file}`);
}

console.log(`Catalog competitions: ${catalog.length}`);
console.log(`Authored-v2 files expected: ${expectedFiles.size}`);
console.log(`Failures: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (failures.length) {
  console.log("RESULT: FAILED");
  failures.forEach(x => console.log("- " + x));
  warnings.slice(0, 50).forEach(x => console.log("WARN - " + x));
  process.exit(1);
}

console.log("RESULT: PASS");
if (warnings.length) warnings.forEach(x => console.log("WARN - " + x));
