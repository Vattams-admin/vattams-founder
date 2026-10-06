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
  status: "draft" | "enabled" | "retired";
  question_bank_public: string;
  answer_key: string;
  question_count: number;
  time_seconds: number;
  section_blueprint?: Record<string, number>;
};

type AssessmentRegistry = { version: number; assessments: Record<string, AssessmentDefinition> };
type AttemptRow = {
  id: string; student_id: string; course_id: string; assessment_id: string; domain: string;
  kind: string; status: "in_progress" | "submitted"; started_at: string;
  question_ids: string[] | null; is_mock: boolean;
};

async function verifyFirebaseToken(authorization: string | null): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) throw new Error("Missing authorization token");
  if (!FIREBASE_PROJECT_ID) throw new Error("Firebase project configuration missing");
  const token = authorization.slice(7).trim();
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`, audience: FIREBASE_PROJECT_ID,
  });
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw new Error("Invalid Firebase token");
  return uid;
}

async function loadRegistry(): Promise<AssessmentRegistry> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download("assessments/registry.json");
  if (error || !data) throw new Error(`Unable to load assessment registry: ${error?.message || "missing file"}`);
  return JSON.parse(await data.text()) as AssessmentRegistry;
}

async function getAssessment(assessmentId: string, courseId: string): Promise<AssessmentDefinition> {
  const registry = await loadRegistry();
  const definition = registry.assessments?.[assessmentId];
  if (!definition || definition.status !== "enabled") throw new Error("Assessment is not enabled");
  if (
    definition.assessment_id !== assessmentId || definition.course_id !== courseId ||
    !definition.question_bank_public || !definition.answer_key ||
    !Number.isInteger(definition.question_count) || definition.question_count <= 0 ||
    !Number.isInteger(definition.time_seconds) || definition.time_seconds <= 0
  ) throw new Error("Assessment configuration is incomplete");
  return definition;
}

async function loadJson(path: string, label: string): Promise<any> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(path);
  if (error || !data) throw new Error(`Unable to load assessment ${label}: ${error?.message || "missing file"}`);
  return JSON.parse(await data.text());
}

async function loadQuestionIds(definition: AssessmentDefinition): Promise<string[]> {
  const parsed = await loadJson(definition.question_bank_public, "public question bank");
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) throw new Error("Public question bank has invalid format");

  const ids = questions.map((q: any) => typeof q?.question_id === "string" ? q.question_id.trim() : "");
  if (ids.some((id: string) => !id) || new Set(ids).size !== ids.length) {
    throw new Error("Public question bank contains invalid or duplicate IDs");
  }

  for (const q of questions) {
    if (Object.prototype.hasOwnProperty.call(q, "correct_option_index") ||
        Object.prototype.hasOwnProperty.call(q, "explanation") ||
        Object.prototype.hasOwnProperty.call(q, "answer")) {
      throw new Error(`Public question bank contains private scoring data: ${q.question_id || "unknown"}`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4 ||
        q.options.some((x: unknown) => typeof x !== "string" || !x.trim())) {
      throw new Error(`Invalid options for question: ${q.question_id || "unknown"}`);
    }
  }

  const keyParsed = await loadJson(definition.answer_key, "private answer key");
  const entries = Array.isArray(keyParsed) ? keyParsed : keyParsed?.questions || keyParsed?.answers;
  if (!Array.isArray(entries)) throw new Error("Private answer key has invalid format");
  const keyIds = entries.map((q: any) => typeof q?.question_id === "string" ? q.question_id.trim() : "");
  if (keyIds.some((id: string) => !id) || new Set(keyIds).size !== keyIds.length) {
    throw new Error("Private answer key contains invalid or duplicate IDs");
  }
  const keySet = new Set(keyIds);
  for (const id of ids) {
    if (!keySet.has(id)) throw new Error(`Answer key missing question: ${id}`);
  }

  return ids;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function checkAccess(studentId: string, courseId: string, assessmentId: string): Promise<void> {
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

async function findActiveAttempt(studentId: string, assessmentId: string): Promise<AttemptRow | null> {
  const { data, error } = await supabase.from("assessment_attempts")
    .select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,question_ids,is_mock")
    .eq("student_id", studentId).eq("assessment_id", assessmentId).eq("status", "in_progress").maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data as AttemptRow | null;
}

async function buildResponse(attempt: AttemptRow) {
  const { data, error } = await supabase.from("assessment_answers")
    .select("question_id,answer,selected_option_index").eq("attempt_id", attempt.id);
  if (error) throw new Error(`Answer lookup failed: ${error.message}`);
  return {
    attempt_id: attempt.id, course_id: attempt.course_id, assessment_id: attempt.assessment_id,
    domain: attempt.domain, kind: attempt.kind, status: attempt.status, started_at: attempt.started_at,
    question_ids: attempt.question_ids || [],
    answers: (data || []).map((row) => ({
      question_id: row.question_id, answer: row.answer, selected_option_index: row.selected_option_index,
    })),
  };
}

async function startOrResume(studentId: string, courseId: string, assessmentId: string) {
  const assessment = await getAssessment(assessmentId, courseId);
  await checkAccess(studentId, courseId, assessmentId);

  const existing = await findActiveAttempt(studentId, assessmentId);
  if (existing) return buildResponse(existing);

  const allQuestionIds = await loadQuestionIds(assessment);
  if (allQuestionIds.length < assessment.question_count) {
    throw new Error(`Question bank has ${allQuestionIds.length} questions; ${assessment.question_count} required`);
  }

  const questionIds = shuffled(allQuestionIds).slice(0, assessment.question_count);

  const { data, error } = await supabase.from("assessment_attempts").insert({
    student_id: studentId, course_id: courseId, assessment_id: assessmentId,
    domain: assessment.domain, kind: assessment.kind, status: "in_progress",
    started_at: new Date().toISOString(), question_ids: questionIds,
    is_mock: assessment.kind === "mock_test",
  }).select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,question_ids,is_mock").single();

  if (error) {
    if (error.code === "23505") {
      const raced = await findActiveAttempt(studentId, assessmentId);
      if (raced) return buildResponse(raced);
    }
    throw new Error(`Unable to create assessment attempt: ${error.message}`);
  }
  return buildResponse(data as AttemptRow);
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
    const studentId = await verifyFirebaseToken(request.headers.get("Authorization"));
    const body = await request.json();
    if ((body?.action || "start_or_resume") !== "start_or_resume") return jsonResponse({ error: "Unsupported action" }, 400);
    const courseId = typeof body?.course_id === "string" ? body.course_id.trim() : "";
    const assessmentId = typeof body?.assessment_id === "string" ? body.assessment_id.trim() : "";
    if (!courseId || !assessmentId) return jsonResponse({ error: "course_id and assessment_id are required" }, 400);
    return jsonResponse(await startOrResume(studentId, courseId, assessmentId));
  } catch (error) {
    console.error("assessment-attempt error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to start assessment" }, 400);
  }
});
