import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "config", "vattams-academia-complete-platform-catalog.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8"));

const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

expect(catalog.scope === "pan_india", "catalog must be pan_india");
expect(catalog.school.classes.join(",") === "1,2,3,4,5,6,7,8,9,10,11,12", "school classes must cover 1-12");
expect(catalog.school.curriculum_tracks.some(x => x.id === "cbse"), "CBSE missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "icse"), "ICSE missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "state_board"), "state board missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "matriculation"), "matriculation missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "international_ib"), "IB missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "international_cambridge"), "Cambridge missing");
expect(catalog.school.curriculum_tracks.some(x => x.id === "international_edexcel"), "Edexcel missing");

const families = [
  ...catalog.competitive_exams.families,
  ...catalog.entrance_exams.families,
  ...catalog.professional.families,
];
for (const family of families) {
  expect(family.id && family.name, "every family requires id and name");
  expect(Array.isArray(family.exams) || Array.isArray(family.stages) || Array.isArray(family.tracks), `family ${family.id} has no examinable structure`);
}
expect(catalog.entrance_exams.families.some(x => x.id === "medical" && x.exams.includes("neet-ug")), "NEET missing");
expect(catalog.entrance_exams.families.some(x => x.id === "engineering" && x.exams.includes("jee-main")), "JEE Main missing");
expect(catalog.professional.families.some(x => x.id === "ca"), "CA missing");
expect(catalog.professional.families.some(x => x.id === "cma"), "CMA missing");
expect(catalog.professional.families.some(x => x.id === "cs"), "CS missing");
expect(catalog.professional.families.some(x => x.id === "audit_assurance"), "Audit & Assurance track missing");

const runtime = catalog.question_runtime;
expect(runtime.options_per_question === 4, "MCQ option count must be 4");
expect(runtime.official_attempt.hide.includes("correct_answer"), "official attempt must hide correct answer");
expect(runtime.official_attempt.hide.includes("explanation"), "official attempt must hide explanation");
expect(runtime.practice.show_after_submission.includes("correct_answer"), "practice must reveal correct answer after submission");
expect(runtime.practice.show_after_submission.includes("explanation"), "practice must reveal reasoning after submission");
expect(runtime.official_attempt.randomize_question_order, "official questions must randomize");
expect(runtime.official_attempt.randomize_option_order, "official options must randomize");
expect(runtime.selection_order[0] === "curriculum_eligibility", "curriculum eligibility must precede age filtering");
expect(catalog.principles.ceo_approval_is_audited, "CEO approval must be auditable");
expect(catalog.principles.machine_translation_cannot_auto_publish, "machine translation cannot auto-publish");

if (errors.length) {
  console.error("VATTAMS Academia complete platform catalog validation FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("VATTAMS Academia complete platform catalog validation PASSED");
console.log(`School classes: ${catalog.school.classes.length}`);
console.log(`School curriculum tracks: ${catalog.school.curriculum_tracks.length}`);
console.log(`Competitive exam families: ${catalog.competitive_exams.families.length}`);
console.log(`Entrance exam families: ${catalog.entrance_exams.families.length}`);
console.log(`Professional families: ${catalog.professional.families.length}`);
