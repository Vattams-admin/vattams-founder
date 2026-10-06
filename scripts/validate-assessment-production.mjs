#!/usr/bin/env node
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "academia-course-materials";
const REGISTRY_PATH = "assessments/registry.json";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

async function loadJson(path, label) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status} ${await response.text()}`);
  try { return await response.json(); } catch { throw new Error(`${label}: invalid JSON`); }
}

function publicQuestions(value) { return Array.isArray(value) ? value : value?.questions; }
function privateQuestions(value) { return Array.isArray(value) ? value : value?.questions || value?.answers; }

const registry = await loadJson(REGISTRY_PATH, "registry");
if (registry?.version !== 1 || !registry?.assessments || typeof registry.assessments !== "object") {
  throw new Error("Production assessment registry must use version 1 and contain assessments");
}

const domains = new Set(["competition", "competitive-exam", "tuition"]);
const kinds = new Set(["topic_practice", "sectional_test", "pyq_test", "mock_test", "official_attempt", "chapter_test", "subject_test"]);
const statuses = new Set(["draft", "reviewed", "published", "retired"]);

let published = 0;
for (const [id, a] of Object.entries(registry.assessments)) {
  if (!a || a.assessment_id !== id) throw new Error(`Assessment ${id}: registry key mismatch`);
  if (!domains.has(a.domain) || !kinds.has(a.kind) || !statuses.has(a.status)) throw new Error(`Assessment ${id}: invalid domain/kind/status`);
  if (!Number.isInteger(a.question_count) || a.question_count <= 0) throw new Error(`Assessment ${id}: invalid question_count`);
  if (!Number.isInteger(a.time_seconds) || a.time_seconds <= 0) throw new Error(`Assessment ${id}: invalid time_seconds`);
  if (a.domain === "competition" && a.kind === "official_attempt") throw new Error(`Assessment ${id}: official Competition attempt must use isolated runtime`);

  if (a.status !== "reviewed" && a.status !== "published") continue;

  const [pubRaw, keyRaw] = await Promise.all([
    loadJson(a.question_bank_public, `${id} public bank`),
    loadJson(a.answer_key, `${id} answer key`),
  ]);
  const pub = publicQuestions(pubRaw);
  const key = privateQuestions(keyRaw);
  if (!Array.isArray(pub) || !pub.length || !Array.isArray(key) || !key.length) throw new Error(`Assessment ${id}: banks must be non-empty arrays`);
  if (pub.length !== key.length || a.question_count > pub.length) throw new Error(`Assessment ${id}: bank/count mismatch`);

  const pubIds = new Set();
  for (const [i, q] of pub.entries()) {
    if (typeof q?.question_id !== "string" || pubIds.has(q.question_id)) throw new Error(`Assessment ${id} public[${i}]: invalid/duplicate question_id`);
    pubIds.add(q.question_id);
    if (q.course_id !== a.course_id || q.assessment_id !== a.assessment_id) throw new Error(`Assessment ${id} public[${i}]: ownership mismatch`);
    if (typeof q.question !== "string" || !q.question.trim()) throw new Error(`Assessment ${id} public[${i}]: question required`);
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(x => typeof x !== "string" || !x.trim()) || new Set(q.options.map(x => x.trim())).size !== 4) throw new Error(`Assessment ${id} public[${i}]: exactly four unique options required`);
    for (const f of ["correct_option_index","explanation","answer","answer_text","correct_answer"]) if (Object.hasOwn(q,f)) throw new Error(`Assessment ${id} public[${i}]: private field ${f} leaked`);
    for (const f of ["subject","topic","subtopic","language"]) if (typeof q[f] !== "string" || !q[f].trim()) throw new Error(`Assessment ${id} public[${i}]: ${f} required`);
    if (!["easy","medium","hard"].includes(q.difficulty) || !Number.isFinite(q.marks) || q.marks <= 0 || !Number.isFinite(q.time_seconds) || q.time_seconds <= 0) throw new Error(`Assessment ${id} public[${i}]: invalid difficulty/marks/time`);
  }

  const keyIds = new Set();
  for (const [i, q] of key.entries()) {
    if (typeof q?.question_id !== "string" || keyIds.has(q.question_id) || !pubIds.has(q.question_id)) throw new Error(`Assessment ${id} key[${i}]: invalid/duplicate/missing question_id`);
    keyIds.add(q.question_id);
    if (!Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3) throw new Error(`Assessment ${id} key[${i}]: correct_option_index must be 0..3`);
    if (typeof q.explanation !== "string" || q.explanation.trim().length < 12 || q.review_status !== "reviewed") throw new Error(`Assessment ${id} key[${i}]: explanation/review status invalid`);
  }
  if (pubIds.size !== keyIds.size) throw new Error(`Assessment ${id}: public/private IDs do not match`);
  if (a.status === "published") published++;
}

console.log(`PRODUCTION ASSESSMENT REGISTRY VALID: ${Object.keys(registry.assessments).length} definitions, ${published} published`);
