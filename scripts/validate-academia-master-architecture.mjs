import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "config/academia-learning-journey.json",
  "config/academia-catalog-taxonomy.json",
  "config/india-education-registry.json",
  "config/content-library-registry.json"
];

const fail = [];
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) {
    fail.push(`Missing ${file}`);
    continue;
  }
  try { read(file); } catch (error) { fail.push(`Invalid JSON ${file}: ${error.message}`); }
}

if (!fail.length) {
  const journey = read(files[0]);
  const taxonomy = read(files[1]);
  const india = read(files[2]);

  for (const domain of ["school","competitive-exam","entrance-exam","professional","competition"]) {
    if (!journey.domains[domain]) fail.push(`Missing journey domain: ${domain}`);
  }

  const requiredSchoolCurricula = ["cbse","cisce","nios","state_board","matriculation","ib","cambridge-international","pearson-edexcel"];
  for (const id of requiredSchoolCurricula) {
    if (!taxonomy.school.curricula.includes(id)) fail.push(`Missing school curriculum: ${id}`);
  }

  if (JSON.stringify(taxonomy.school.classes) !== JSON.stringify(india.classes.map((item) => item.number))) {
    fail.push("School class taxonomy does not match India education registry.");
  }

  const q = journey.question_contract;
  if (q.options_exactly !== 4 || !q.options_unique || !q.answer_hidden_during_official_attempt) {
    fail.push("Objective assessment contract must require four unique options and hidden official answers.");
  }

  const s = journey.selection_engine;
  if (s.question_selection !== "blueprint_controlled_random" || s.question_order !== "student_specific_random" || s.option_order !== "student_specific_random") {
    fail.push("Randomization contract is incomplete.");
  }

  if (!journey.governance.ceo_auto_approval.enabled || journey.governance.ceo_auto_approval.never_bypass.length === 0) {
    fail.push("CEO approval must be configured but must not bypass mandatory gates.");
  }

  if (journey.governance.machine_translation_auto_publish !== false) {
    fail.push("Machine translation cannot auto-publish.");
  }

  if (journey.assessment_security.server_side_scoring !== true) {
    fail.push("Official assessment scoring must remain server-side.");
  }
}

if (fail.length) {
  console.error("Academia master architecture validation failed:");
  for (const item of fail) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Academia master learning + assessment architecture validation passed.");
