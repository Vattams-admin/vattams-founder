#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const BUCKET = "academia-course-materials";
const registryPath = process.env.COMPETITION_REGISTRY_PATH || "config/competition-registry.json";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
if (!fs.existsSync(registryPath)) throw new Error(`Missing registry: ${registryPath}`);

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const entries = Object.values(registry.competitions || {}).filter((entry) => entry?.enabled === true);
if (entries.length !== 24) throw new Error(`Expected 24 enabled competition registry entries, found ${entries.length}`);

function readJson(relativePath) {
  const file = path.join(root, "data", "competitions", relativePath, "full-bank", "objective");
  return file;
}

function cleanQuestion(q, courseId, competition) {
  return {
    question_id: q.question_id,
    course_id: courseId,
    competition,
    age_band: q.age_band,
    topic: q.topic,
    subtopic: q.subtopic,
    question: q.question,
    question_type: "Multiple Choice",
    options: q.options,
    difficulty: q.difficulty || "",
    skill: q.skill || "",
    marks: Number(q.marks) || 1,
    time_seconds: Number(q.time_seconds) || 60,
    language: q.language || "English",
    review_status: q.review_status,
  };
}

function cleanKey(q) {
  return {
    answer: String(q.answer ?? "").trim(),
    explanation: q.explanation || "",
    correct_option_index: q.correct_option_index,
  };
}

async function upload(storagePath, body) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "x-upsert": "true",
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Upload failed for ${storagePath}: HTTP ${response.status} ${detail}`);
  }
}

for (const entry of entries) {
  const dir = readJson(entry.slug);
  const publicPath = path.join(dir, "questions.objective.public.json");
  const privatePath = path.join(dir, "answer-key.objective.private.json");
  const officialPath = path.join(dir, "official.objective.json");
  const agePoolsPath = path.join(dir, "age-pools.json");
  const blueprintPath = path.join(dir, "selection-blueprint.json");
  for (const file of [publicPath, privatePath, officialPath, agePoolsPath, blueprintPath]) {
    if (!fs.existsSync(file)) throw new Error(`${entry.slug}: missing ${path.relative(root, file)}`);
  }

  const publicBank = JSON.parse(fs.readFileSync(publicPath, "utf8"));
  const privateBank = JSON.parse(fs.readFileSync(privatePath, "utf8"));
  const officialBank = JSON.parse(fs.readFileSync(officialPath, "utf8"));
  const agePools = JSON.parse(fs.readFileSync(agePoolsPath, "utf8"));
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));

  if (!Array.isArray(publicBank) || !Array.isArray(privateBank) || !Array.isArray(officialBank)) {
    throw new Error(`${entry.slug}: runtime question sources must be arrays`);
  }
  if (publicBank.length < 120 || officialBank.length < 120) {
    throw new Error(`${entry.slug}: runtime banks are below production minimum`);
  }

  // Official questions may intentionally overlap the reviewed public bank.
  // Merge by question_id while rejecting conflicting definitions.
  const questions = {};
  for (const q of [...publicBank, ...officialBank]) {
    if (!q?.question_id) throw new Error(`${entry.slug}: question missing question_id`);
    const cleaned = cleanQuestion(q, entry.course_id, entry.competition);
    const existing = questions[q.question_id];
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        throw new Error(`${entry.slug}: conflicting question_id ${q.question_id} between runtime sources`);
      }
      continue;
    }
    questions[q.question_id] = cleaned;
  }
  const keys = {};
  for (const q of [...privateBank, ...officialBank]) {
    if (!q?.question_id) throw new Error(`${entry.slug}: answer key missing question_id`);
    const cleaned = cleanKey(q);
    const existing = keys[q.question_id];
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(cleaned)) {
        throw new Error(`${entry.slug}: conflicting answer key ${q.question_id} between runtime sources`);
      }
      continue;
    }
    keys[q.question_id] = cleaned;
  }

  const requiredBands = ["up_to_8", "age_9_12", "age_13_15", "age_16_plus"];
  for (const band of requiredBands) {
    if (!Array.isArray(entry.official_papers?.[band]) || entry.official_papers[band].length !== 30) {
      throw new Error(`${entry.slug}: official paper ${band} is not exactly 30 IDs`);
    }
    if (!Array.isArray(blueprint?.[band]) || blueprint[band].reduce((n, pair) => n + Number(pair?.[1] || 0), 0) !== 30) {
      throw new Error(`${entry.slug}: blueprint ${band} is not exactly 30`);
    }
  }

  await upload(entry.question_bundle, { course_id: entry.course_id, competition: entry.competition, questions });
  await upload(entry.answer_key_bundle, keys);
  await upload(entry.age_pools, agePools);
  console.log(`PUBLISHED: ${entry.slug}`);
}

await upload("competitions/registry.json", JSON.stringify(registry, null, 2) + "\n");
console.log(`RESULT: PASS — published ${entries.length}/24 competition runtime packages and registry`);
