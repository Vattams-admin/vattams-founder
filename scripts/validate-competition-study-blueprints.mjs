import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "./catalog-data.mjs";

const file = path.resolve("content/competition-study-materials/competition-study-blueprints.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const catalog = CATALOG_ITEMS.filter((x) => x.category_id === CATEGORY.VATTAMS_COMPETITIONS).map((x) => x.name);
const blueprints = data.competitions ?? {};
const failures = [];
const MIN_DOMAINS = Number(data.content_architecture?.minimum_domains ?? 6);
const MIN_SUBTOPICS = Number(data.content_architecture?.minimum_subtopics_per_domain ?? 3);

if (data.content_architecture?.lesson_count_per_competition !== null) {
  failures.push("fixed lesson count must be null");
}
if (data.content_architecture?.fixed_day_limit !== false) {
  failures.push("fixed day limit must be false");
}
if (Object.keys(blueprints).length !== catalog.length) {
  failures.push(`blueprint count ${Object.keys(blueprints).length} != catalog count ${catalog.length}`);
}

for (const name of catalog) {
  const spec = blueprints[name];
  if (!spec) { failures.push(`${name}: missing blueprint`); continue; }
  const domains = Array.isArray(spec.domains) ? spec.domains : [];
  if (domains.length < MIN_DOMAINS) failures.push(`${name}: fewer than ${MIN_DOMAINS} curriculum domains`);
  if (!Array.isArray(spec.age_bands) || spec.age_bands.length < 2) failures.push(`${name}: missing meaningful age/level paths`);
  if (!Array.isArray(spec.learning_paths) || spec.learning_paths.length < 3) failures.push(`${name}: missing learning paths`);
  const seen = new Set();
  domains.forEach((domain, i) => {
    const title = String(domain?.title ?? "").trim();
    if (!title) failures.push(`${name} domain ${i + 1}: missing title`);
    const key = title.toLowerCase();
    if (seen.has(key)) failures.push(`${name}: duplicate domain ${title}`);
    seen.add(key);
    const subs = Array.isArray(domain?.subtopics) ? domain.subtopics : [];
    if (subs.length < MIN_SUBTOPICS) failures.push(`${name} / ${title}: fewer than ${MIN_SUBTOPICS} subtopics`);
    if (typeof domain?.expansion_required !== "boolean") failures.push(`${name} / ${title}: expansion_required must be an explicit boolean`);
  });
}

for (const name of Object.keys(blueprints)) {
  if (!catalog.includes(name)) failures.push(`UNMATCHED BLUEPRINT: ${name}`);
}

console.log(`Catalog competitions: ${catalog.length}`);
console.log(`Blueprint competitions: ${Object.keys(blueprints).length}`);
console.log(`Blueprint coverage: ${catalog.filter((x) => blueprints[x]).length}/${catalog.length}`);
console.log(`Required model: Thirukkural-style scalable curriculum; minimum domains=${MIN_DOMAINS}, subtopics/domain=${MIN_SUBTOPICS}`);
if (failures.length) {
  console.log("RESULT: FAILED — authoring is incomplete");
  failures.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("RESULT: PASS");
