import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SERVICE_KEY = KEYS["default"] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "academia-course-materials";
const REGISTRY_PATH = "assessments/registry.json";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function verify(auth: string | null) {
  if (!auth?.startsWith("Bearer ") || !PROJECT_ID) throw new Error("Unauthorized");
  const token = auth.slice(7).trim();
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return { uid: payload.sub, token };
}

function firestoreBase() {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents`;
}

async function firestoreGet(path: string, token: string) {
  const r = await fetch(`${firestoreBase()}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Admin authorization lookup failed");
  return await r.json();
}

async function isAdmin(uid: string, token: string) {
  const doc = await firestoreGet(`admins/${encodeURIComponent(uid)}`, token);
  const fields = doc?.fields;
  return fields?.is_active?.booleanValue === true &&
    ["admin", "super_admin", "instructor"].includes(fields?.role?.stringValue || "");
}

async function loadRegistry() {
  const { data, error } = await supabase.storage.from(BUCKET).download(REGISTRY_PATH);
  if (error || !data) throw new Error("Unable to load assessment registry");
  const registry = JSON.parse(await data.text());
  if (!registry || registry.version !== 1 || !registry.assessments) throw new Error("Assessment registry is invalid");
  return registry;
}

async function loadJson(path: unknown, label: string) {
  if (typeof path !== "string" || !path.trim()) throw new Error(`${label} path is missing`);
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`${label} is missing`);
  try { return JSON.parse(await data.text()); } catch { throw new Error(`${label} is not valid JSON`); }
}

function publicQuestions(value: any) {
  return Array.isArray(value) ? value : value?.questions;
}

function privateQuestions(value: any) {
  return Array.isArray(value) ? value : value?.questions || value?.answers;
}

async function validateAssessment(a: any) {
  const errors: string[] = [];
  const required = ["assessment_id", "course_id", "slug", "title", "domain", "kind", "question_bank_public", "answer_key"];
  for (const f of required) if (typeof a?.[f] !== "string" || !a[f].trim()) errors.push(`${f} is required`);
  if (!Number.isInteger(a?.question_count) || a.question_count <= 0) errors.push("question_count must be positive");
  if (!Number.isInteger(a?.time_seconds) || a.time_seconds <= 0) errors.push("time_seconds must be positive");
  if (a?.domain === "competition" && a?.kind === "official_attempt") errors.push("Generic engine cannot replace Competition official-attempt runtime");

  if (a?.section_blueprint != null) {
    if (typeof a.section_blueprint !== "object" || Array.isArray(a.section_blueprint)) {
      errors.push("section_blueprint must be an object");
    } else {
      let total = 0;
      for (const [key, value] of Object.entries(a.section_blueprint)) {
        if (!Number.isInteger(value) || (value as number) <= 0) errors.push(`blueprint count for ${key} must be positive`);
        else total += value as number;
      }
      if (total !== a.question_count) errors.push(`blueprint total ${total} does not equal question_count ${a.question_count}`);
    }
  }

  if (errors.length) return { passed: false, errors };

  let pub: any, key: any;
  try {
    [pub, key] = await Promise.all([
      loadJson(a.question_bank_public, "Public question bank"),
      loadJson(a.answer_key, "Private answer key"),
    ]);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Unable to load assessment banks");
    return { passed: false, errors };
  }

  const publicBank = publicQuestions(pub);
  const privateBank = privateQuestions(key);
  if (!Array.isArray(publicBank) || !publicBank.length) errors.push("Public bank must be a non-empty array");
  if (!Array.isArray(privateBank) || !privateBank.length) errors.push("Private answer key must be a non-empty array");
  if (errors.length) return { passed: false, errors };

  if (a.question_count > publicBank.length) errors.push("question_count exceeds public bank size");
  if (publicBank.length !== privateBank.length) errors.push("Public/private bank counts differ");

  const publicIds = new Set<string>();
  for (let i = 0; i < publicBank.length; i++) {
    const q = publicBank[i];
    const label = `public[${i}]`;
    if (typeof q?.question_id !== "string" || !q.question_id.trim()) errors.push(`${label}: question_id required`);
    else if (publicIds.has(q.question_id)) errors.push(`${label}: duplicate question_id ${q.question_id}`);
    else publicIds.add(q.question_id);
    if (q?.course_id !== a.course_id) errors.push(`${label}: course_id mismatch`);
    if (q?.assessment_id !== a.assessment_id) errors.push(`${label}: assessment_id mismatch`);
    if (typeof q?.question !== "string" || !q.question.trim()) errors.push(`${label}: question required`);
    if (!Array.isArray(q?.options) || q.options.length !== 4 || q.options.some((x: unknown) => typeof x !== "string" || !x.trim())) errors.push(`${label}: exactly four non-empty options required`);
    else if (new Set(q.options.map((x: string) => x.trim())).size !== 4) errors.push(`${label}: options must be unique`);
    for (const f of ["correct_option_index", "explanation", "answer", "answer_text", "correct_answer"]) {
      if (Object.prototype.hasOwnProperty.call(q || {}, f)) errors.push(`${label}: private field ${f} must not exist`);
    }
    for (const f of ["subject", "topic", "subtopic", "language"]) if (typeof q?.[f] !== "string" || !q[f].trim()) errors.push(`${label}: ${f} required`);
    if (!["easy", "medium", "hard"].includes(q?.difficulty)) errors.push(`${label}: invalid difficulty`);
    if (!Number.isFinite(q?.marks) || q.marks <= 0) errors.push(`${label}: marks must be positive`);
    if (!Number.isFinite(q?.time_seconds) || q.time_seconds <= 0) errors.push(`${label}: time_seconds must be positive`);
  }

  const keyIds = new Set<string>();
  for (let i = 0; i < privateBank.length; i++) {
    const q = privateBank[i];
    const label = `private[${i}]`;
    if (typeof q?.question_id !== "string" || !q.question_id.trim()) errors.push(`${label}: question_id required`);
    else if (keyIds.has(q.question_id)) errors.push(`${label}: duplicate question_id ${q.question_id}`);
    else keyIds.add(q.question_id);
    if (!publicIds.has(q?.question_id)) errors.push(`${label}: question_id missing from public bank`);
    if (!Number.isInteger(q?.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3) errors.push(`${label}: correct_option_index must be 0..3`);
    if (typeof q?.explanation !== "string" || q.explanation.trim().length < 12) errors.push(`${label}: explanation must contain at least 12 characters`);
    if (q?.review_status !== "reviewed") errors.push(`${label}: review_status must be reviewed`);
    if (!Number.isFinite(q?.marks) || q.marks <= 0) errors.push(`${label}: marks must be positive`);
  }
  for (const id of publicIds) if (!keyIds.has(id)) errors.push(`missing private answer-key entry for ${id}`);
  return { passed: errors.length === 0, errors: errors.slice(0, 100) };
}

async function saveRegistry(registry: any) {
  const { error } = await supabase.storage.from(BUCKET).upload(
    REGISTRY_PATH,
    new Blob([JSON.stringify(registry, null, 2) + "\n"], { type: "application/json" }),
    { upsert: true, contentType: "application/json" },
  );
  if (error) throw new Error(`Unable to save assessment registry: ${error.message}`);
}

async function audit(assessmentId: string, adminId: string, action: string, previous: string | null, next: string | null, validation: any) {
  const { error } = await supabase.from("assessment_admin_audit").insert({
    assessment_id: assessmentId, admin_id: adminId, action,
    previous_status: previous, new_status: next,
    validation_passed: validation.passed, validation_errors: validation.errors,
  });
  if (error) throw new Error(`Unable to write assessment audit: ${error.message}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const auth = await verify(request.headers.get("Authorization"));
    if (!(await isAdmin(auth.uid, auth.token))) return json({ error: "Admin access required" }, 403);

    const body = await request.json();
    const action = String(body?.action || "list");
    const registry = await loadRegistry();

    if (action === "list") {
      const rows = await Promise.all(Object.values(registry.assessments).map(async (a: any) => {
        const validation = await validateAssessment(a);
        return { ...a, validation_status: validation.passed ? "passed" : "failed", validation_errors: validation.errors };
      }));
      return json({ assessments: rows });
    }

    const assessmentId = typeof body?.assessment_id === "string" ? body.assessment_id.trim() : "";
    if (!assessmentId || !registry.assessments[assessmentId]) return json({ error: "Assessment not found" }, 404);
    const assessment = registry.assessments[assessmentId];

    if (action === "validate") {
      const validation = await validateAssessment(assessment);
      await audit(assessmentId, auth.uid, "validate", assessment.status || null, assessment.status || null, validation);
      return json({ assessment_id: assessmentId, ...validation });
    }

    if (action === "review") {
      if (assessment.status !== "draft") return json({ error: "Only draft assessments can be reviewed" }, 409);
      const validation = await validateAssessment(assessment);
      if (!validation.passed) {
        await audit(assessmentId, auth.uid, "review", assessment.status, assessment.status, validation);
        return json({ error: "Assessment validation failed", ...validation }, 422);
      }
      assessment.status = "reviewed";
      await saveRegistry(registry);
      await audit(assessmentId, auth.uid, "review", "draft", "reviewed", validation);
      return json({ ok: true, assessment: { ...assessment, validation_status: "passed", validation_errors: [] } });
    }

    if (action === "publish") {
      if (assessment.domain === "competition" && assessment.kind === "official_attempt") {
        return json({ error: "Competition official-attempt runtime is protected from generic publishing" }, 409);
      }
      if (assessment.status !== "reviewed") return json({ error: "Only reviewed assessments can be published" }, 409);
      const validation = await validateAssessment(assessment);
      if (!validation.passed) {
        await audit(assessmentId, auth.uid, "publish", assessment.status, assessment.status, validation);
        return json({ error: "Assessment validation failed", ...validation }, 422);
      }
      assessment.status = "published";
      await saveRegistry(registry);
      await audit(assessmentId, auth.uid, "publish", "reviewed", "published", validation);
      return json({ ok: true, assessment: { ...assessment, validation_status: "passed", validation_errors: [] } });
    }

    if (action === "retire") {
      if (assessment.status !== "published") return json({ error: "Only published assessments can be retired" }, 409);
      const validation = { passed: true, errors: [] as string[] };
      assessment.status = "retired";
      await saveRegistry(registry);
      await audit(assessmentId, auth.uid, "retire", "published", "retired", validation);
      return json({ ok: true, assessment: { ...assessment, validation_status: "passed", validation_errors: [] } });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("assessment-admin error", error);
    return json({ error: error instanceof Error ? error.message : "Assessment administration failed" }, 500);
  }
});
