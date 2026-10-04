import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "../../../scripts/catalog-data.mjs";

const root = path.resolve("content/competition-study-materials");
const blueprint = JSON.parse(fs.readFileSync(path.join(root, "competition-study-blueprints.json"), "utf8"));
const catalog = CATALOG_ITEMS.filter((x) => x.category_id === CATEGORY.VATTAMS_COMPETITIONS).map((x) => x.name);
const failures = [];
const warnings = [];
const specs = blueprint.competitions ?? {};
const arch = blueprint.content_architecture ?? {};

if (arch.lesson_count_per_competition !== null) failures.push("fixed lesson count must be null");
if (arch.fixed_day_limit !== false) failures.push("fixed day limit must be false");
if (Object.keys(specs).length !== catalog.length) failures.push("blueprint count does not match catalog count");

for (const name of catalog) {
  const spec = specs[name];
  if (!spec) { failures.push(name + ": missing curriculum blueprint"); continue; }
  const domains = Array.isArray(spec.domains) ? spec.domains : [];
  if (domains.length < Number(arch.minimum_domains ?? 6)) failures.push(name + ": fewer than required curriculum domains");
  if (!Array.isArray(spec.age_bands) || spec.age_bands.length < 2) failures.push(name + ": missing age/level paths");
  if (!Array.isArray(spec.learning_paths) || spec.learning_paths.length < 3) failures.push(name + ": missing learning paths");
  const seen = new Set();
  for (const domain of domains) {
    const title = String(domain?.title ?? "").trim();
    if (!title) failures.push(name + ": domain missing title");
    if (seen.has(title.toLowerCase())) failures.push(name + ": duplicate domain " + title);
    seen.add(title.toLowerCase());
    const subs = Array.isArray(domain?.subtopics) ? domain.subtopics : [];
    if (subs.length < Number(arch.minimum_subtopics_per_domain ?? 3)) failures.push(name + " / " + title + ": subtopics not authored");
    if (domain?.expansion_required === true) warnings.push(name + " / " + title + ": still marked expansion_required");
  }
}
for (const name of Object.keys(specs)) if (!catalog.includes(name)) failures.push("UNMATCHED BLUEPRINT: " + name);

console.log("Catalog competitions: " + catalog.length);
console.log("Blueprint competitions: " + Object.keys(specs).length);
console.log("Coverage: " + catalog.filter((x) => specs[x]).length + "/" + catalog.length);
console.log("Fixed 10-day model: " + (arch.lesson_count_per_competition === null && arch.fixed_day_limit === false ? "REMOVED" : "STILL PRESENT"));
warnings.slice(0, 20).forEach((x) => console.log("WARNING: " + x));
if (failures.length) { console.log("RESULT: FAILED — curriculum authoring incomplete"); failures.forEach((x) => console.log("- " + x)); process.exit(1); }
console.log("RESULT: PASS");
