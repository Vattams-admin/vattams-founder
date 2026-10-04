import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "../../../scripts/catalog-data.mjs";

const dir = path.resolve(".vattams-550-check/VATTAMS_ACADEMIA_10_DAY_550_LESSONS");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const files = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && n !== "ALL_550_LESSONS.json" && n !== "manifest.json");
const catalog = CATALOG_ITEMS.filter((x) => x.category_id === CATEGORY.VATTAMS_COMPETITIONS).map((x) => x.name);
const packages = new Map();

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  if (data.course?.category === "competition") packages.set(data.course?.name ?? file, { file, data });
}

const failures = [];
const warnings = [];
const textOf = (v) => typeof v === "string" ? v.trim() : Array.isArray(v) ? v.map(textOf).join(" ").trim() : v && typeof v === "object" ? Object.values(v).map(textOf).join(" ").trim() : String(v ?? "").trim();
const words = (v) => textOf(v).split(/\s+/).filter(Boolean).length;
const norm = (v) => textOf(v).toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

for (const name of catalog) {
  const entry = packages.get(name);
  if (!entry) { failures.push(`${name}: NO STUDY-MATERIAL PACKAGE`); continue; }
  const lessons = Array.isArray(entry.data.lessons) ? entry.data.lessons : [];
  if (lessons.length < 10) failures.push(`${name}: fewer than 10 lessons`);
  if (lessons.some((x) => x.status !== "ready_for_production")) failures.push(`${name}: lessons are not marked ready_for_production`);

  for (const field of ["examples","practical_activity","guided_practice","independent_practice","core_teaching_content","objective"]) {
    if (new Set(lessons.map((x) => norm(x[field]))).size < Math.min(lessons.length, 8)) failures.push(`${name}: insufficient lesson-specific ${field}`);
  }

  for (const field of ["objective","core_teaching_content","examples","guided_practice","independent_practice","assessment_checkpoint","student_task","reflection_completion"]) {
    if (lessons.some((x) => !textOf(x[field]))) failures.push(`${name}: missing ${field}`);
  }

  lessons.forEach((lesson, i) => {
    const label = `${name} lesson ${i + 1}`;
    if (words(lesson.objective) < 12) failures.push(`${label}: objective too short`);
    if (words(lesson.core_teaching_content) < 80) failures.push(`${label}: core teaching content below 80 words`);
    if (words(lesson.assessment_checkpoint) < 12) failures.push(`${label}: assessment checkpoint too short`);
    if (words(lesson.student_task) < 12) failures.push(`${label}: student task too short`);
    if (words(lesson.reflection_completion) < 12) failures.push(`${label}: reflection/completion too short`);
    const examples = Array.isArray(lesson.examples) ? lesson.examples : [lesson.examples];
    const practice = Array.isArray(lesson.independent_practice) ? lesson.independent_practice : [lesson.independent_practice];
    if (examples.filter((x) => textOf(x)).length < 2) failures.push(`${label}: fewer than 2 worked/example items`);
    if (practice.filter((x) => textOf(x)).length < 3) failures.push(`${label}: fewer than 3 independent-practice items`);
  });
}

for (const name of packages.keys()) if (!new Set(catalog).has(name)) failures.push(`UNMATCHED STUDY PACKAGE: ${name}`);
if (manifest.course_categories?.competition !== catalog.length) warnings.push(`manifest competition count (${manifest.course_categories?.competition ?? "unknown"}) differs from current catalog (${catalog.length})`);

console.log(`Current catalog competition count: ${catalog.length}`);
console.log(`Study packages found: ${packages.size}`);
console.log(`Manifest competition count: ${manifest.course_categories?.competition ?? "unknown"}`);
console.log(`Coverage: ${catalog.filter((name) => packages.has(name)).length}/${catalog.length}`);
for (const warning of warnings) console.log(`WARNING: ${warning}`);
if (failures.length) { console.log("RESULT: FAILED"); for (const failure of failures) console.log(`- ${failure}`); process.exit(1); }
console.log("RESULT: PASS");
