#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CATALOG_ITEMS, CATEGORY } from "./catalog-data.mjs";

function loadDotEnvLocal() {
  const p = path.resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnvLocal();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!projectId) throw new Error("Missing Firebase project ID");
if (!serviceJson) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

const serviceAccount = JSON.parse(serviceJson);
if (!getApps().length) initializeApp({ credential: cert(serviceAccount), projectId });
const db = getFirestore();

const root = process.cwd();
const registryPath = path.join(root, "config/competition-registry.json");
const existing = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const previous = existing.competitions || {};
const competitions = CATALOG_ITEMS.filter((x) => x.category_id === CATEGORY.VATTAMS_COMPETITIONS);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const registry = { version: 1, competitions: {} };
const usedIds = new Set();

for (const item of competitions) {
  const snap = await db.collection("courses").where("slug", "==", item.slug).limit(2).get();
  if (snap.empty) throw new Error(`Missing Firestore course for ${item.name} (${item.slug})`);
  if (snap.size !== 1) throw new Error(`Duplicate Firestore course slug for ${item.name}: ${snap.size}`);

  const doc = snap.docs[0];
  const courseId = doc.id;
  if (usedIds.has(courseId)) throw new Error(`Duplicate course ID: ${courseId}`);
  usedIds.add(courseId);

  const objectiveDir = path.join(root, "data", "competitions", item.slug, "full-bank", "objective");
  const blueprintPath = path.join(objectiveDir, "selection-blueprint.json");
  const poolsPath = path.join(objectiveDir, "age-pools.json");
  const publicPath = path.join(objectiveDir, "questions.objective.public.json");
  const privatePath = path.join(objectiveDir, "answer-key.objective.private.json");
  const officialPath = path.join(objectiveDir, "official.objective.json");

  for (const p of [blueprintPath, poolsPath, publicPath, privatePath, officialPath]) {
    if (!existsSync(p)) throw new Error(`Missing runtime package source: ${path.relative(root, p)}`);
  }

  const blueprint = readJson(blueprintPath);
  const pools = readJson(poolsPath);
  const officialBank = readJson(officialPath);
  if (!Array.isArray(officialBank) || officialBank.length < 30) {
    throw new Error(item.name + ": official bank must contain at least 30 questions");
  }
  for (const band of ["up_to_8", "age_9_12", "age_13_15", "age_16_plus"]) {
    if (!Array.isArray(blueprint[band]) || blueprint[band].length === 0) {
      throw new Error(`${item.name}: missing selection blueprint for ${band}`);
    }
    const total = blueprint[band].reduce((n, pair) => n + Number(pair?.[1] || 0), 0);
    if (total !== 30) throw new Error(`${item.name}: ${band} blueprint totals ${total}, expected 30`);
    if (!pools[band] || typeof pools[band] !== "object") {
      throw new Error(`${item.name}: missing age pool ${band}`);
    }
  }

  const officialPapers = {};
  for (const band of ["up_to_8", "age_9_12", "age_13_15", "age_16_plus"]) {
    const ids = officialBank
      .filter((q) => q?.age_band === band && typeof q?.question_id === "string")
      .map((q) => q.question_id);
    const unique = [...new Set(ids)];
    if (unique.length < 30) {
      throw new Error(item.name + ": official bank has only " + unique.length + " unique questions for " + band + "; need 30");
    }
    officialPapers[band] = unique.slice(0, 30);
  }

  const prior = previous[courseId] || Object.values(previous).find((x) => x.slug === item.slug);
  const entry = {
    course_id: courseId,
    competition: item.name,
    slug: item.slug,
    question_bundle: `competitions/${item.slug}/objective/questions.private.json`,
    answer_key_bundle: `competitions/${item.slug}/objective/answer-keys.private.json`,
    age_pools: `competitions/${item.slug}/objective/age-pools.json`,
    per_attempt: 30,
    selection_blueprint: blueprint,
    official_papers: officialPapers,
    enabled: true,
  };
  registry.competitions[courseId] = entry;
}

fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
console.log(`Generated runtime registry: ${competitions.length}/${competitions.length} competitions`);
console.log(JSON.stringify(Object.values(registry.competitions).map((x) => ({ course_id: x.course_id, slug: x.slug, per_attempt: x.per_attempt, enabled: x.enabled })), null, 2));
