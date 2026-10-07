import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SECRET_KEYS["default"] || "";
const SUPABASE_BUCKET = "academia-course-materials";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const firebaseJWKS = createRemoteJWKSet(new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
));

type AssessmentDefinition = {
  assessment_id: string;
  course_id: string;
  domain: "competition" | "competitive-exam" | "tuition";
  kind: "topic_practice" | "sectional_test" | "pyq_test" | "mock_test" | "official_attempt" | "chapter_test" | "subject_test";
  status: "draft" | "reviewed" | "published" | "retired";
  question_bank_public: string;
  answer_key: string;
  question_count: number;
  time_seconds: number;
  section_blueprint?: Record<string, number>;
  selection_blueprint?: {
    questionCount: number;
    difficultyDistribution: { easy: number; medium: number; hard: number };
    topicDistribution: Array<{ subject: string; topic: string; proportion: number }>;
  };
  blueprint_id?: string;
  release_version?: string;
  release_public_sha256?: string;
  release_private_sha256?: string;
  eligibility?: {
    curriculum?: string[];
    classNumbers?: number[];
    examIds?: string[];
    ageBands?: string[];
  };
};

type AssessmentRegistry = { version: number; assessments: Record<string, AssessmentDefinition> };
type AttemptRow = {
  id: string; student_id: string; course_id: string; assessment_id: string; domain: string;
  kind: string; status: "in_progress" | "submitted"; started_at: string;
  question_ids: string[] | null; is_mock: boolean; release_version: string; release_public_sha256: string; release_private_sha256: string; integrity_sha256: string; option_orders: Record<string, number[]>; expires_at: string;
};

async function verifyFirebaseToken(authorization: string | null): Promise<{ uid: string; token: string; claims: Record<string, unknown> }> {
  if (!authorization?.startsWith("Bearer ")) throw new Error("Missing authorization token");
  if (!FIREBASE_PROJECT_ID) throw new Error("Firebase project configuration missing");
  const token = authorization.slice(7).trim();
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`, audience: FIREBASE_PROJECT_ID,
  });
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw new Error("Invalid Firebase token");
  return { uid, token, claims: payload as Record<string, unknown> };
}

\nasync function canonicalSha256(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function attemptIntegrityHash(attempt: { release_version: string; release_public_sha256: string; release_private_sha256: string; question_ids: string[]; option_orders: Record<string, number[]> }): Promise<string> {
  return canonicalSha256({
    release_version: attempt.release_version,
    release_public_sha256: attempt.release_public_sha256,
    release_private_sha256: attempt.release_private_sha256,
    question_ids: attempt.question_ids,
    option_orders: attempt.option_orders,
  });
}

async function verifyRegisteredBank(definition: any, publicParsed: unknown, privateParsed?: unknown): Promise<void> {
  if (typeof definition.bank_manifest !== "string" || !definition.bank_manifest) {
    throw new Error("Assessment bank manifest is not registered");
  }
  const manifestFile = await supabase.storage.from(SUPABASE_BUCKET).download(definition.bank_manifest);
  if (manifestFile.error || !manifestFile.data) throw new Error("Unable to load assessment bank manifest");
  const manifest = JSON.parse(await manifestFile.data.text());
  if (manifest.assessmentId !== definition.assessment_id || manifest.questionCount !== definition.question_count || manifest.answerKeyPrivate !== true) {
    throw new Error("Assessment bank manifest does not match registry");
  }
  if (manifest.publicBank !== definition.question_bank_public || manifest.privateAnswerKey !== definition.answer_key) {
    throw new Error("Assessment bank paths do not match registered manifest");
  }
  const publicHash = await canonicalSha256(publicParsed);
  if (publicHash !== manifest.publicSha256) throw new Error("Public assessment bank integrity check failed");
  if (privateParsed !== undefined) {
    const privateHash = await canonicalSha256(privateParsed);
    if (privateHash !== manifest.privateSha256) throw new Error("Private assessment answer-key integrity check failed");
  }
}

async function loadRegistry(): Promise<AssessmentRegistry> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download("assessments/registry.json");
  if (error || !data) throw new Error(`Unable to load assessment registry: ${error?.message || "missing file"}`);
  return JSON.parse(await data.text()) as AssessmentRegistry;
}

async function getAssessment(assessmentId: string, courseId: string): Promise<AssessmentDefinition> {
  const registry = await loadRegistry();
  const definition = registry.assessments?.[assessmentId];
  if (!definition || definition.status !== "published") throw new Error("Assessment is not published");
  if (
    definition.assessment_id !== assessmentId || definition.course_id !== courseId ||
    !definition.question_bank_public || !definition.answer_key ||
    !Number.isInteger(definition.question_count) || definition.question_count <= 0 ||
    !Number.isInteger(definition.time_seconds) || definition.time_seconds <= 0 ||
    !definition.release_version || !definition.release_public_sha256 || !definition.release_private_sha256
  ) throw new Error("Assessment configuration is incomplete");
  return definition;
}

async function loadJson(path: string, label: string): Promise<any> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(path);
  if (error || !data) throw new Error(`Unable to load assessment ${label}: ${error?.message || "missing file"}`);
  return JSON.parse(await data.text());
}

type Question = {
  question_id: string;
  subject?: string;
  topic?: string;
  curriculum_locator?: string | Record<string, unknown>;
  curriculum?: string;
  class_number?: number;
  exam_id?: string;
  age_band?: string;
  difficulty?: "easy" | "medium" | "hard";
  options?: string[];
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function shuffled<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distributionCounts(total: number, distribution: Record<string, number>): Record<string, number> {
  const entries = Object.entries(distribution);
  const counts = Object.fromEntries(entries.map(([k, v]) => [k, Math.floor(total * v)]));
  let remaining = total - Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = entries
    .map(([k, v]) => ({ k, fraction: total * v - Math.floor(total * v) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remaining; i++) counts[ranked[i % ranked.length].k]++;
  return counts;
}

function validateBlueprint(assessment: AssessmentDefinition) {
  const bp = assessment.selection_blueprint;
  if (!bp) throw new Error("Published assessment is missing selection blueprint");
  if (bp.questionCount !== assessment.question_count) throw new Error("Selection blueprint question count does not match assessment");
  const dsum = bp.difficultyDistribution.easy + bp.difficultyDistribution.medium + bp.difficultyDistribution.hard;
  if (Math.abs(dsum - 1) > 0.000001) throw new Error("Difficulty distribution must sum to 1");
  const tsum = bp.topicDistribution.reduce((s, x) => s + Number(x.proportion), 0);
  if (Math.abs(tsum - 1) > 0.000001) throw new Error("Topic distribution must sum to 1");
}

function matchesEligibility(q: Question, assessment: AssessmentDefinition, claims: Record<string, unknown>): boolean {
  const e = assessment.eligibility;
  if (!e) return true;
  if (e.curriculum?.length && !e.curriculum.includes(String(claims.curriculum || ""))) return false;
  if (e.classNumbers?.length && !e.classNumbers.includes(Number(claims.class_number))) return false;
  if (e.examIds?.length && !e.examIds.includes(String(claims.exam_id || ""))) return false;
  if (e.ageBands?.length && !e.ageBands.includes(String(claims.age_band || ""))) return false;
  if (e.ageBands?.length && !q.age_band) return false;
  if (e.curriculum?.length && !q.curriculum_locator && !q.curriculum) return false;
  return true;
}

function matchesTopic(q: Question, t: { subject: string; topic: string }): boolean {
  return normalize(q.subject) === normalize(t.subject) && normalize(q.topic) === normalize(t.topic);
}

async function loadQuestionBank(definition: AssessmentDefinition): Promise<Question[]> {
  const parsed = await loadJson(definition.question_bank_public, "public question bank");
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) throw new Error("Public question bank has invalid format");
  const ids = questions.map((q: Question) => typeof q?.question_id === "string" ? q.question_id.trim() : "");
  if (ids.some((id: string) => !id) || new Set(ids).size !== ids.length) throw new Error("Public question bank contains invalid or duplicate IDs");
  for (const q of questions) {
    if (Object.prototype.hasOwnProperty.call(q, "correct_option_index") ||
        Object.prototype.hasOwnProperty.call(q, "explanation") ||
        Object.prototype.hasOwnProperty.call(q, "answer")) {
      throw new Error(`Public question bank contains private scoring data: ${q.question_id || "unknown"}`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((x: unknown) => typeof x !== "string" || !x.trim())) {
      throw new Error(`Invalid options for question: ${q.question_id || "unknown"}`);
    }
    if (!["easy", "medium", "hard"].includes(q.difficulty || "")) throw new Error(`Question missing valid difficulty: ${q.question_id || "unknown"}`);
    if (!q.age_band) throw new Error(`Question missing age band: ${q.question_id || "unknown"}`);
  }
  const keyParsed = await loadJson(definition.answer_key, "private answer key");
  await verifyRegisteredBank(definition, parsed, keyParsed);
  const entries = Array.isArray(keyParsed) ? keyParsed : keyParsed?.questions || keyParsed?.answers;
  if (!Array.isArray(entries)) throw new Error("Private answer key has invalid format");
  const keyIds = entries.map((q: any) => typeof q?.question_id === "string" ? q.question_id.trim() : "");
  if (keyIds.some((id: string) => !id) || new Set(keyIds).size !== keyIds.length) throw new Error("Private answer key contains invalid or duplicate IDs");
  const keySet = new Set(keyIds);
  for (const id of ids) if (!keySet.has(id)) throw new Error(`Answer key missing question: ${id}`);
  return questions as Question[];
}

async function recentQuestionIds(studentId: string, assessmentId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("assessment_attempts")
    .select("question_ids").eq("student_id", studentId).eq("assessment_id", assessmentId)
    .eq("status", "submitted").order("started_at", { ascending: false }).limit(3);
  if (error) throw new Error(`Recent attempt lookup failed: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data || []) for (const id of Array.isArray(row.question_ids) ? row.question_ids : []) if (typeof id === "string") ids.add(id);
  return ids;
}

function selectQuestions(questions: Question[], assessment: AssessmentDefinition, claims: Record<string, unknown>, recent: Set<string>, random: () => number): Question[] {
  validateBlueprint(assessment);
  const bp = assessment.selection_blueprint!;
  const eligible = questions.filter(q => matchesEligibility(q, assessment, claims));
  if (eligible.length < bp.questionCount) throw new Error(`Eligible question inventory is ${eligible.length}; ${bp.questionCount} required`);

  const alternatives = eligible.filter(q => !recent.has(q.question_id));
  const pool = alternatives.length >= bp.questionCount ? alternatives : eligible;
  const difficultyTargets = distributionCounts(bp.questionCount, bp.difficultyDistribution);
  const topicTargets = new Map(bp.topicDistribution.map(t => [normalize(t.subject)+"::"+normalize(t.topic), Math.round(bp.questionCount * t.proportion)]));
  const topicSelected = new Map<string, number>();
  const difficultySelected = new Map<string, number>();
  const selected: Question[] = [];
  const remaining = [...pool];

  while (selected.length < bp.questionCount) {
    const candidates = remaining.filter(q => {
      const d = q.difficulty || "";
      const dk = normalize(q.subject)+"::"+normalize(q.topic);
      return (difficultySelected.get(d) || 0) < (difficultyTargets[d] || 0) &&
        (topicTargets.has(dk) ? (topicSelected.get(dk) || 0) < (topicTargets.get(dk) || 0) : true);
    });
    if (!candidates.length) break;
    candidates.sort((a, b) => {
      const ad = (difficultyTargets[a.difficulty || ""] || 0) - (difficultySelected.get(a.difficulty || "") || 0);
      const bd = (difficultyTargets[b.difficulty || ""] || 0) - (difficultySelected.get(b.difficulty || "") || 0);
      const ak = normalize(a.subject)+"::"+normalize(a.topic);
      const bk = normalize(b.subject)+"::"+normalize(b.topic);
      const at = (topicTargets.get(ak) || 0) - (topicSelected.get(ak) || 0);
      const bt = (topicTargets.get(bk) || 0) - (topicSelected.get(bk) || 0);
      return (bd + bt) - (ad + at);
    });
    const topScore = candidates.slice(0, Math.min(8, candidates.length));
    const q = topScore[Math.floor(random() * topScore.length)];
    selected.push(q);
    remaining.splice(remaining.indexOf(q), 1);
    difficultySelected.set(q.difficulty || "", (difficultySelected.get(q.difficulty || "") || 0) + 1);
    const key = normalize(q.subject)+"::"+normalize(q.topic);
    topicSelected.set(key, (topicSelected.get(key) || 0) + 1);
  }

  if (selected.length !== bp.questionCount) {
    throw new Error("Blueprint cannot be satisfied by eligible question inventory; assessment start blocked");
  }
  return shuffled(selected, random);
}

function buildOptionOrders(questionIds: string[], questions: Question[], random: () => number): Record<string, number[]> {
  const byId = new Map(questions.map(q => [q.question_id, q]));
  const orders: Record<string, number[]> = {};
  for (const id of questionIds) orders[id] = shuffled([0,1,2,3], random);
  if (Object.keys(orders).length !== questionIds.length || Object.keys(byId).length === 0) throw new Error("Unable to build option permutations");
  return orders;
}

async function refreshAccess(studentId: string, courseId: string, assessmentId: string, token: string): Promise<void> {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "enrolments" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "student_id" }, op: "EQUAL", value: { stringValue: studentId } } },
          { fieldFilter: { field: { fieldPath: "course_id" }, op: "EQUAL", value: { stringValue: courseId } } },
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
        ]}},
        limit: 1,
      },
    }),
  });
  if (!response.ok) throw new Error("Unable to verify course enrolment");
  const rows = await response.json();
  const active = Array.isArray(rows) && rows.some((row: any) => row?.document);
  const { error } = await supabase.from("assessment_access_cache").upsert({
    student_id: studentId, course_id: courseId, assessment_id: assessmentId,
    enrolment_active: active, is_admin: false, checked_at: new Date().toISOString(),
  }, { onConflict: "student_id,course_id,assessment_id" });
  if (error) throw new Error(`Assessment access refresh failed: ${error.message}`);
}

async function checkAccess(studentId: string, courseId: string, assessmentId: string, token: string): Promise<void> {
  await refreshAccess(studentId, courseId, assessmentId, token);
  const { data, error } = await supabase.from("assessment_access_cache")
    .select("enrolment_active,is_admin,checked_at")
    .eq("student_id", studentId).eq("course_id", courseId).eq("assessment_id", assessmentId).maybeSingle();
  if (error) throw new Error(`Assessment access lookup failed: ${error.message}`);
  if (!data || (!data.is_admin && !data.enrolment_active)) throw new Error("You do not have access to this assessment");
  const checkedAt = new Date(data.checked_at).getTime();
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > 60 * 60 * 1000) {
    throw new Error("Your assessment access information is out of date");
  }
}

async function findLatestAttempt(studentId: string, assessmentId: string): Promise<AttemptRow | null> {
  const { data, error } = await supabase.from("assessment_attempts")
    .select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,expires_at,question_ids,is_mock,release_version,release_public_sha256,release_private_sha256,integrity_sha256,option_orders,expires_at")
    .eq("student_id", studentId).eq("assessment_id", assessmentId)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data as AttemptRow | null;
}

async function buildResponse(attempt: AttemptRow, timeSeconds: number) {
  const { data, error } = await supabase.from("assessment_answers")
    .select("question_id,answer,selected_option_index").eq("attempt_id", attempt.id);
  if (error) throw new Error(`Answer lookup failed: ${error.message}`);

  const { data: result } = await supabase.from("assessment_results")
    .select("score,max_score,answered_count,submitted_at")
    .eq("attempt_id", attempt.id).maybeSingle();

  return {
    attempt_id: attempt.id, course_id: attempt.course_id, assessment_id: attempt.assessment_id, time_seconds: timeSeconds,
    domain: attempt.domain, kind: attempt.kind, status: attempt.status, started_at: attempt.started_at,
    question_ids: attempt.question_ids || [],
    result: result ? {
      score: result.score, max_score: result.max_score, answered_count: result.answered_count,
      submitted_at: result.submitted_at,
    } : null,
    answers: (data || []).map((row) => ({
      question_id: row.question_id, answer: row.answer, selected_option_index: row.selected_option_index,
    })),
  };
}

async function startOrResume(studentId: string, courseId: string, assessmentId: string, token: string, claims: Record<string, unknown>) {
  const assessment = await getAssessment(assessmentId, courseId);
  await checkAccess(studentId, courseId, assessmentId, token);
  const blueprintRegistry = await loadBlueprintRegistry();
  if (!assessment.blueprint_id || !blueprintRegistry.blueprints?.[assessment.blueprint_id]) {
    throw new Error("Assessment has no executable blueprint");
  }
  const executableBlueprint = blueprintRegistry.blueprints[assessment.blueprint_id];
  if (executableBlueprint.status !== "ready") {
    throw new Error("Assessment blueprint is not ready for production use");
  }
  if (!executableBlueprint.difficulty_distribution || !Array.isArray(executableBlueprint.topic_distribution)) {
    throw new Error("Assessment blueprint is missing reviewed difficulty/topic distributions");
  }
  assessment.selection_blueprint = {
    questionCount: executableBlueprint.question_count,
    difficultyDistribution: executableBlueprint.difficulty_distribution,
    topicDistribution: executableBlueprint.topic_distribution,
  };

  const existing = await findLatestAttempt(studentId, assessmentId);
  if (existing?.status === "in_progress") {
    if (!existing.expires_at || Date.now() >= Date.parse(existing.expires_at)) throw new Error("Assessment attempt time has expired");
    if (!existing.integrity_sha256 || (await attemptIntegrityHash({ release_version: existing.release_version, release_public_sha256: existing.release_public_sha256, release_private_sha256: existing.release_private_sha256, question_ids: existing.question_ids || [], option_orders: existing.option_orders || {} })) !== existing.integrity_sha256) throw new Error("Assessment attempt integrity check failed");
    return buildResponse(existing, assessment.time_seconds);
  }
  if (existing?.status === "submitted") return buildResponse(existing, assessment.time_seconds);

  const questions = await loadQuestionBank(assessment);
  const recent = await recentQuestionIds(studentId, assessmentId);
  const random = seededRandom(`${studentId}:${assessmentId}:${crypto.randomUUID()}`);
  const selected = selectQuestions(questions, assessment, claims, recent, random);
  const questionIds = selected.map(q => q.question_id);
  const optionOrders = buildOptionOrders(questionIds, selected, random);
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.parse(startedAt) + assessment.time_seconds * 1000).toISOString();

  const { data, error } = await supabase.from("assessment_attempts").insert({
    student_id: studentId, course_id: courseId, assessment_id: assessmentId,
    domain: assessment.domain, kind: assessment.kind, status: "in_progress",
    started_at: startedAt, expires_at: expiresAt, question_ids: questionIds, option_orders: optionOrders,
    release_version: assessment.release_version, release_public_sha256: assessment.release_public_sha256, release_private_sha256: assessment.release_private_sha256,
    integrity_sha256: await attemptIntegrityHash({ release_version: assessment.release_version!, release_public_sha256: assessment.release_public_sha256!, release_private_sha256: assessment.release_private_sha256!, question_ids: questionIds, option_orders: optionOrders }),
    is_mock: assessment.kind === "mock_test",
  }).select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,question_ids,is_mock").single();

  if (error) {
    if (error.code === "23505") {
      const raced = await findLatestAttempt(studentId, assessmentId);
      if (raced) return buildResponse(raced, assessment.time_seconds);
    }
    throw new Error(`Unable to create assessment attempt: ${error.message}`);
  }
  return buildResponse(data as AttemptRow, assessment.time_seconds);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json",
  }});
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }});
  try {
    const auth = await verifyFirebaseToken(request.headers.get("Authorization"));
    const body = await request.json();
    if ((body?.action || "start_or_resume") !== "start_or_resume") return jsonResponse({ error: "Unsupported action" }, 400);
    const courseId = typeof body?.course_id === "string" ? body.course_id.trim() : "";
    const assessmentId = typeof body?.assessment_id === "string" ? body.assessment_id.trim() : "";
    if (!courseId || !assessmentId) return jsonResponse({ error: "course_id and assessment_id are required" }, 400);
    return jsonResponse(await startOrResume(auth.uid, courseId, assessmentId, auth.token, auth.claims));
  } catch (error) {
    console.error("assessment-attempt error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to start assessment" }, 400);
  }
});
