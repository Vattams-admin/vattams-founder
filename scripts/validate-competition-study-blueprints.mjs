import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "./catalog-data.mjs";

const file = path.resolve("content/competition-study-materials/competition-study-blueprints.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const catalog = CATALOG_ITEMS.filter((x) => x.category_id === CATEGORY.VATTAMS_COMPETITIONS).map((x) => x.name);
const blueprints = data.competitions ?? {};
const failures = [];

if (Object.keys(blueprints).length !== catalog.length) {
  failures.push(`blueprint count ${Object.keys(blueprints).length} != catalog count ${catalog.length}`);
}

for (const name of catalog) {
  const topics = blueprints[name];
  if (!topics) { failures.push(`${name}: missing blueprint`); continue; }
  if (topics.length !== 10) failures.push(`${name}: expected 10 lesson topics, found ${topics.length}`);
  if (new Set(topics.map((x) => x.trim().toLowerCase())).size !== topics.length) {
    failures.push(`${name}: duplicate lesson topics`);
  }
  topics.forEach((topic, i) => {
    if (topic.trim().split(/\s+/).length < 2) failures.push(`${name} lesson ${i + 1}: topic too short`);
  });
}

for (const name of Object.keys(blueprints)) {
  if (!catalog.includes(name)) failures.push(`UNMATCHED BLUEPRINT: ${name}`);
}

console.log(`Catalog competitions: ${catalog.length}`);
console.log(`Blueprint competitions: ${Object.keys(blueprints).length}`);
console.log(`Blueprint coverage: ${catalog.filter((x) => blueprints[x]).length}/${catalog.length}`);
if (failures.length) {
  console.log("RESULT: FAILED");
  failures.forEach((x) => console.log(`- ${x}`));
  process.exit(1);
}
console.log("RESULT: PASS");
