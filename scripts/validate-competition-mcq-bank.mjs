import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
};
const slug = arg("--slug");
if (!slug) throw new Error("Usage: node scripts/validate-competition-mcq-bank.mjs --slug <slug>");

const dir = path.join(root, "data", "competitions", slug, "full-bank", "objective");
const files = {
  public: path.join(dir, "questions.objective.public.json"),
  private: path.join(dir, "answer-key.objective.private.json"),
  official: path.join(dir, "official.objective.json"),
  pools: path.join(dir, "age-pools.json"),
  blueprint: path.join(dir, "selection-blueprint.json"),
};
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
for (const [k,p] of Object.entries(files)) if (!fs.existsSync(p)) throw new Error(`Missing ${k}: ${path.relative(root,p)}`);

const publicBank = read(files.public);
const privateBank = read(files.private);
const official = read(files.official);
const pools = read(files.pools);
const blueprint = read(files.blueprint);

if (!Array.isArray(publicBank) || publicBank.length < 120) throw new Error("Mock bank must contain at least 120 MCQs");
if (!Array.isArray(official) || official.length < 30) throw new Error("Official bank must contain at least 30 MCQs");
if (!Array.isArray(privateBank)) throw new Error("Private answer key must be an array");
if (!pools || typeof pools !== "object") throw new Error("Invalid age-pools.json");
if (!blueprint || typeof blueprint !== "object") throw new Error("Explicit selection-blueprint.json is required");

const SCAFFOLD_PATTERNS = [
  /an unrelated concept/i,
  /a reversed interpretation/i,
  /a random guess/i,
  /the core concept represented by/i,
  /apply .+ correctly in an appropriate context/i,
  /complete a representative/i,
  /key rule, clue, language feature or performance criterion/i,
];
const hasScaffold = (value) => SCAFFOLD_PATTERNS.some((pattern) => pattern.test(String(value ?? "")));

const validateMcq = (q, label) => {
  if (!q.question_id || !q.question || !q.age_band || !q.topic || !q.subtopic) throw new Error(`${label}: missing identity/curriculum mapping`);
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(v => typeof v !== "string" || !v.trim())) {
    throw new Error(`${label}: exactly 4 non-empty options are required`);
  }
  if (!Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3) {
    throw new Error(`${label}: correct_option_index must be 0..3`);
  }
  if (typeof q.answer !== "string" || !q.answer.trim()) throw new Error(`${label}: answer is required`);
  if (typeof q.explanation !== "string" || q.explanation.trim().length < 12) throw new Error(`${label}: explanation is required`);
  if (q.review_status !== "reviewed") throw new Error(`${label}: review_status must be reviewed before production packaging`);
  const text = [q.question, ...(q.options || []), q.answer, q.explanation, q.topic, q.subtopic].join(" ");
  if (hasScaffold(text)) throw new Error(`${label}: scaffold/template content detected; production MCQ must be subject-authored`);
};

const ids = new Set();
for (const [i,q] of publicBank.entries()) {
  validateMcq(q, `mock[${i}]`);
  if (ids.has(q.question_id)) throw new Error(`Duplicate mock question_id: ${q.question_id}`);
  ids.add(q.question_id);
}
const officialIds = new Set();
for (const [i,q] of official.entries()) {
  validateMcq(q, `official[${i}]`);
  if (officialIds.has(q.question_id)) throw new Error(`Duplicate official question_id: ${q.question_id}`);
  officialIds.add(q.question_id);
}
for (const band of ["up_to_8","age_9_12","age_13_15","age_16_plus"]) {
  const topics = pools[band];
  if (!topics || typeof topics !== "object") throw new Error(`Missing age band: ${band}`);
  const idsForBand = Object.values(topics).flat().map(x => typeof x === "string" ? x : x?.id || x?.question_id).filter(Boolean);
  if (new Set(idsForBand).size < 30) throw new Error(`${band}: fewer than 30 unique questions`);
  if (!Array.isArray(blueprint[band]) || blueprint[band].length === 0) throw new Error(`${band}: explicit selection blueprint required`);
  const total = blueprint[band].reduce((n, pair) => n + Number(pair?.[1] || 0), 0);
  if (total !== 30) throw new Error(`${band}: blueprint must select exactly 30 questions`);
}
console.log(`RESULT: PASS — ${slug}: ${publicBank.length} reviewed mock MCQs, ${official.length} official MCQs, 4 age pools, explicit 30-question blueprint`);

// Validation run after GK authored-bank replacement.

// Full 24-competition production validation is orchestrated by the CI workflow.\n
// Trigger report workflow after enabling contents write permission.\n
// Persist report before final production gate failure.\n
// Trigger CI summary diagnostics.\n
// Trigger published CI failure report.\n
// Validate after deterministic runtime source preparation.\n