import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const supabase = createClient(URL, KEYS["default"] || "", { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

async function verify(auth: string | null): Promise<{ uid: string; token: string }> {
  if (!auth?.startsWith("Bearer ") || !PROJECT_ID) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(auth.slice(7).trim(), jwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return { uid: payload.sub, token: auth.slice(7).trim() };
}

async function verifyActiveEnrollment(studentId: string, courseId: string, token: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(base, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "enrolments" }], where: { compositeFilter: { op: "AND", filters: [
    { fieldFilter: { field: { fieldPath: "student_id" }, op: "EQUAL", value: { stringValue: studentId } } },
    { fieldFilter: { field: { fieldPath: "course_id" }, op: "EQUAL", value: { stringValue: courseId } } },
    { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
  ]}}, limit: 1 } }) });
  if (!response.ok) throw new Error("Unable to verify course enrolment");
  const rows = await response.json();
  if (!(Array.isArray(rows) && rows.some((row: any) => row?.document))) throw new Error("You no longer have access to this assessment");
}

\nasync function canonicalSha256(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function attemptIntegrityHash(attempt: any): Promise<string> {
  return canonicalSha256({ release_version: attempt.release_version, release_public_sha256: attempt.release_public_sha256, release_private_sha256: attempt.release_private_sha256, question_ids: attempt.question_ids, option_orders: attempt.option_orders });
}

async function verifyRegisteredBank(definition: any, publicParsed: unknown, privateParsed?: unknown): Promise<void> {
  if (typeof definition.bank_manifest !== "string" || !definition.bank_manifest) {
    throw new Error("Assessment bank manifest is not registered");
  }
  const manifestFile = await supabase.storage.from(academia-course-materials).download(definition.bank_manifest);
  if (manifestFile.error || !manifestFile.data) throw new Error("Unable to load assessment bank manifest");
  const manifest = JSON.parse(await manifestFile.data.text());
  if (manifest.assessmentId !== definition.assessment_id || manifest.questionCount !== definition.question_count || manifest.answerKeyPrivate !== true) {
    throw new Error("Assessment bank manifest does not match registry");
  }
  if (definition.release_version !== manifest.version) throw new Error("Published assessment release version is not pinned to its bank manifest");
  if (definition.release_public_sha256 !== manifest.publicSha256 || definition.release_private_sha256 !== manifest.privateSha256) throw new Error("Published assessment release hashes do not match its bank manifest");
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

async function loadPublicQuestions(studentId: string, attemptId: string, token: string) {
  const { data: attempt, error } = await supabase.from("assessment_attempts")
    .select("id,student_id,status,assessment_id,question_ids,option_orders,release_version,release_public_sha256,release_private_sha256,integrity_sha256,option_orders,expires_at").eq("id", attemptId).maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) throw new Error("Assessment attempt does not belong to this student");
  if (!attempt.expires_at || !Number.isFinite(Date.parse(attempt.expires_at))) throw new Error("Assessment attempt has an invalid deadline");
  if (attempt.status === "in_progress" && Date.now() >= Date.parse(attempt.expires_at)) throw new Error("Assessment attempt time has expired");

  if (!attempt.integrity_sha256 || await attemptIntegrityHash(attempt) !== attempt.integrity_sha256) throw new Error("Assessment attempt integrity check failed");
  if (!["in_progress", "submitted"].includes(attempt.status)) throw new Error("Invalid assessment attempt");

  const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids.filter((x: unknown): x is string => typeof x === "string") : [];
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Assessment attempt has invalid question IDs");

  const { data: attemptCourse, error: courseError } = await supabase.from("assessment_attempts").select("course_id").eq("id", attemptId).maybeSingle();
  if (courseError || !attemptCourse?.course_id) throw new Error("Assessment course is unavailable");
  await verifyActiveEnrollment(studentId, attemptCourse.course_id, token);

  const { data: registryFile, error: registryError } = await supabase.storage.from("academia-course-materials").download("assessments/registry.json");
  if (registryError || !registryFile) throw new Error("Unable to load assessment registry");
  const registry = JSON.parse(await registryFile.text());
  const definition = registry.assessments?.[attempt.assessment_id];
  if (!definition || definition.status !== "published") throw new Error("Assessment is not published");
  if (attempt.release_version !== definition.release_version || attempt.release_public_sha256 !== definition.release_public_sha256 || attempt.release_private_sha256 !== definition.release_private_sha256) throw new Error("Assessment release changed after this attempt started; the attempt is locked to its original release");
  const answerReleasePolicy = definition.answerReleasePolicy || definition.answer_release_policy || "after_submission";
  if (!["immediate_practice", "after_submission", "scheduled", "never"].includes(answerReleasePolicy)) {
    throw new Error("Assessment answer release policy is invalid");
  }
  if (attempt.status === "submitted" && answerReleasePolicy === "scheduled") {
    const releaseAt = definition.answerReleaseAt || definition.answer_release_at;
    if (!releaseAt || !Number.isFinite(Date.parse(releaseAt)) || Date.now() < Date.parse(releaseAt)) {
      throw new Error("Assessment review is not yet released");
    }
  }
  if (typeof definition.question_bank_public !== "string" || !definition.question_bank_public) {
    throw new Error("Assessment public question bank is not configured");
  }

  const { data: bankFile, error: bankError } = await supabase.storage.from("academia-course-materials").download(definition.question_bank_public);
  if (bankError || !bankFile) throw new Error("Unable to load assessment question bank");
  const parsed = JSON.parse(await bankFile.text());
  await verifyRegisteredBank(definition, parsed);
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions)) throw new Error("Invalid assessment question bank");

  const byId = new Map(questions.map((q: any) => [q.question_id, q]));
  const publicQuestions = ids.map((id) => {
    const q = byId.get(id);
    if (!q) throw new Error(`Question missing from public bank: ${id}`);
    const options = Array.isArray(q.options) ? q.options : [];
    if (Object.prototype.hasOwnProperty.call(q, "correct_option_index") ||
        Object.prototype.hasOwnProperty.call(q, "explanation")) {
      throw new Error(`Public question contains private scoring fields: ${id}`);
    }
    if (options.length !== 4 || options.some((x: unknown) => typeof x !== "string" || !x.trim())) {
      throw new Error(`Question has invalid options: ${id}`);
    }
    const order = Array.isArray(attempt.option_orders?.[id]) ? attempt.option_orders[id] : [0,1,2,3];
    if (order.length !== 4 || new Set(order).size !== 4 || order.some((x: unknown) => !Number.isInteger(x) || x < 0 || x > 3)) {
      throw new Error(`Invalid private option permutation: ${id}`);
    }
    const shuffledOptions = order.map((index: number) => options[index]);
    return {
      question_id: q.question_id, question: q.question, options: shuffledOptions,
      subject: q.subject, topic: q.topic, subtopic: q.subtopic,
      difficulty: q.difficulty, language: q.language,
      marks: q.marks, time_seconds: q.time_seconds,
    };
  });

  const { data: answers, error: answerError } = await supabase.from("assessment_answers")
    .select("question_id,answer,selected_option_index,is_correct,correct_option_index,explanation,marks_awarded")
    .eq("attempt_id", attemptId);
  if (answerError) throw new Error(`Answer lookup failed: ${answerError.message}`);

  const orders = attempt.option_orders || {};
  const toShuffledIndex = (questionId: string, originalIndex: unknown) => {
    if (!Number.isInteger(originalIndex)) return originalIndex;
    const order = Array.isArray(orders[questionId]) ? orders[questionId] : [0,1,2,3];
    const index = order.indexOf(originalIndex as number);
    return index >= 0 ? index : originalIndex;
  };

  return {
    attempt_id: attemptId, assessment_id: attempt.assessment_id, status: attempt.status,
    questions: publicQuestions,
    answers: (answers || []).map((a: any) => ({
      question_id: a.question_id, answer: a.answer,
      selected_option_index: toShuffledIndex(a.question_id, a.selected_option_index),
      ...((attempt.status === "submitted" && answerReleasePolicy !== "never") ? {
        is_correct: a.is_correct, correct_option_index: toShuffledIndex(a.question_id, a.correct_option_index),
        explanation: a.explanation, marks_awarded: a.marks_awarded,
      } : {}),
    })),
  };
}

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(), "Content-Type": "application/json" } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors() });
  try {
    const auth = await verify(request.headers.get("Authorization"));
    const body = await request.json();
    if ((body?.action || "load") !== "load") return json({ error: "Unsupported action" }, 400);
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    if (!attemptId) return json({ error: "attempt_id is required" }, 400);
    return json(await loadPublicQuestions(auth.uid, attemptId, auth.token));
  } catch (error) {
    console.error("assessment-question-content error", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load assessment questions" }, 400);
  }
});
