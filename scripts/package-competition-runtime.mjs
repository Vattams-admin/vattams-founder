import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
};

const slug = arg("--slug");
const courseId = arg("--course-id");
const competition = arg("--competition");

if (!slug || !courseId || !competition) {
  throw new Error("Usage: node scripts/package-competition-runtime.mjs --slug <slug> --course-id <id> --competition <name>");
}

const source = path.join(root, "data", "competitions", slug, "full-bank", "objective");
const out = path.join(root, ".tmp-competition-runtime", slug);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const required = (p) => {
  if (!fs.existsSync(p)) throw new Error(`Missing ${path.relative(root, p)}`);
  return readJson(p);
};

const publicBank = required(path.join(source, "questions.objective.public.json"));
const privateBank = required(path.join(source, "answer-key.objective.private.json"));
const official = required(path.join(source, "official.objective.json"));
const agePools = required(path.join(source, "age-pools.json"));
const blueprintPath = path.join(source, "selection-blueprint.json");
const blueprint = fs.existsSync(blueprintPath) ? readJson(blueprintPath) : null;

if (!Array.isArray(publicBank) || !Array.isArray(privateBank) || !Array.isArray(official)) {
  throw new Error("Question sources must be arrays");
}
if (publicBank.length < 120) throw new Error("Mock question bank must contain at least 120 questions");
if (official.length < 30) throw new Error("Official pool must contain at least 30 questions");
if (!agePools || typeof agePools !== "object") throw new Error("Invalid age-pools.json");
if (publicBank.some(q => q.review_status !== "reviewed")) {
  throw new Error("Production packaging blocked: every mock question must be review_status=reviewed");
}

const cleanQuestion = (q) => ({
  question_id: q.question_id,
  course_id: courseId,
  competition,
  age_band: q.age_band || "All ages",
  topic: q.topic || "",
  subtopic: q.subtopic || "",
  question: q.question,
  question_type: "Multiple Choice",
  options: q.options,
  difficulty: q.difficulty || "",
  skill: q.skill || "",
  marks: Number(q.marks) || 1,
  time_seconds: Number(q.time_seconds) || 60,
  language: q.language || "English",
  review_status: q.review_status,
});

const cleanKey = (q) => ({
  answer: String(q.answer ?? "").trim(),
  explanation: q.explanation || "",
  correct_option_index: Number.isInteger(q.correct_option_index) ? q.correct_option_index : undefined,
});

const questions = {};
for (const q of [...publicBank, ...official]) {
  if (!q.question_id) throw new Error("Question without question_id");
  if (questions[q.question_id]) throw new Error(`Duplicate question_id: ${q.question_id}`);
  questions[q.question_id] = cleanQuestion(q);
}
const keys = {};
for (const q of [...privateBank, ...official]) {
  if (!q.question_id) throw new Error("Answer key without question_id");
  if (keys[q.question_id]) throw new Error(`Duplicate answer key: ${q.question_id}`);
  keys[q.question_id] = cleanKey(q);
}

for (const [band, topics] of Object.entries(agePools)) {
  if (!topics || typeof topics !== "object") throw new Error(`Invalid age pool: ${band}`);
  const ids = Object.values(topics).flat().map(v => typeof v === "string" ? v : v?.id || v?.question_id).filter(Boolean);
  if (new Set(ids).size < 30) throw new Error(`Age band ${band} has fewer than 30 unique questions`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "competitions", slug, "objective"), { recursive: true });

const registryEntry = {
  course_id: courseId,
  competition,
  slug,
  question_bundle: `competitions/${slug}/objective/questions.private.json`,
  answer_key_bundle: `competitions/${slug}/objective/answer-keys.private.json`,
  age_pools: `competitions/${slug}/objective/age-pools.json`,
  per_attempt: 30,
  ...(blueprint ? { selection_blueprint: blueprint } : {}),
  enabled: true,
};

fs.writeFileSync(
  path.join(out, "competitions", slug, "objective", "questions.private.json"),
  JSON.stringify({ course_id: courseId, competition, questions }, null, 2),
);
fs.writeFileSync(
  path.join(out, "competitions", slug, "objective", "answer-keys.private.json"),
  JSON.stringify(keys, null, 2),
);
fs.writeFileSync(
  path.join(out, "competitions", slug, "objective", "age-pools.json"),
  JSON.stringify(agePools, null, 2),
);
fs.writeFileSync(
  path.join(out, "registry-entry.json"),
  JSON.stringify(registryEntry, null, 2),
);

const files = {};
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
for (const p of [
  path.join(out, "registry-entry.json"),
  path.join(out, "competitions", slug, "objective", "questions.private.json"),
  path.join(out, "competitions", slug, "objective", "answer-keys.private.json"),
  path.join(out, "competitions", slug, "objective", "age-pools.json"),
]) {
  files[path.relative(out, p)] = { sha256: hash(p), bytes: fs.statSync(p).size };
}

fs.writeFileSync(
  path.join(out, "MANIFEST.json"),
  JSON.stringify({
    version: 1,
    competition,
    course_id: courseId,
    slug,
    mock_question_count: publicBank.length,
    official_question_count: official.length,
    combined_question_count: Object.keys(questions).length,
    per_attempt: 30,
    explicit_selection_blueprint: Boolean(blueprint),
    files,
  }, null, 2),
);

console.log(`RUNTIME PACKAGE READY: ${competition}`);
console.log(`Mock questions: ${publicBank.length}`);
console.log(`Official questions: ${official.length}`);
console.log(`Output: ${path.relative(root, out)}`);
