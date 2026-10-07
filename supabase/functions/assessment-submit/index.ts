import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const supabase = createClient(SUPABASE_URL, KEYS["default"] || "", { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

async function uid(auth: string | null): Promise<{ uid: string; token: string }> {
  if (!auth?.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(auth.slice(7).trim(), jwks, {
    issuer: "https://securetoken.google.com/" + FIREBASE_PROJECT_ID, audience: FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return { uid: payload.sub, token: auth.slice(7).trim() };
}


async function canonicalSha256(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function attemptIntegrityHash(attempt: any): Promise<string> {
  return canonicalSha256({ release_version: attempt.release_version, release_public_sha256: attempt.release_public_sha256, release_private_sha256: attempt.release_private_sha256, question_ids: attempt.question_ids, option_orders: attempt.option_orders });
}

async function verifyRegisteredBank(definition: any, publicParsed: unknown, privateParsed: unknown): Promise<void> {
  if (typeof definition.bank_manifest !== "string" || !definition.bank_manifest) throw new Error("Assessment bank manifest is not registered");
  const { data, error } = await supabase.storage.from("academia-course-materials").download(definition.bank_manifest);
  if (error || !data) throw new Error("Unable to load assessment bank manifest");
  const manifest = JSON.parse(await data.text());
  if (manifest.assessmentId !== definition.assessment_id || manifest.questionCount !== definition.question_count || manifest.answerKeyPrivate !== true) {
    throw new Error("Assessment bank manifest does not match registry");
  }
  if (definition.release_version !== manifest.version) throw new Error("Published assessment release version is not pinned to its bank manifest");
  if (definition.release_public_sha256 !== manifest.publicSha256 || definition.release_private_sha256 !== manifest.privateSha256) throw new Error("Published assessment release hashes do not match its bank manifest");
  if (manifest.publicBank !== definition.question_bank_public || manifest.privateAnswerKey !== definition.answer_key) {
    throw new Error("Assessment bank paths do not match registered manifest");
  }
  if (await canonicalSha256(publicParsed) !== manifest.publicSha256) throw new Error("Public assessment bank integrity check failed");
  if (await canonicalSha256(privateParsed) !== manifest.privateSha256) throw new Error("Private assessment answer-key integrity check failed");
}

async function downloadJson(path: string, label: string) {
  if (typeof path !== "string" || !path) throw new Error("Assessment " + label + " is not configured");
  const { data, error } = await supabase.storage.from("academia-course-materials").download(path);
  if (error || !data) throw new Error("Unable to load assessment " + label);
  return JSON.parse(await data.text());
}

async function verifyActiveEnrollment(studentId: string, courseId: string, token: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(base, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "enrolments" }], where: { compositeFilter: { op: "AND", filters: [
    { fieldFilter: { field: { fieldPath: "student_id" }, op: "EQUAL", value: { stringValue: studentId } } },
    { fieldFilter: { field: { fieldPath: "course_id" }, op: "EQUAL", value: { stringValue: courseId } } },
    { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
  ]}}, limit: 1 } }) });
  if (!response.ok) throw new Error("Unable to verify course enrolment");
  const rows = await response.json();
  if (!(Array.isArray(rows) && rows.some((row: any) => row?.document))) throw new Error("You no longer have access to this assessment");
}

async function submit(attemptId: string, studentId: string, token: string) {
  const { data: attempt, error: ae } = await supabase.from("assessment_attempts")
     .select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,question_ids,is_mock,release_version,release_public_sha256,release_private_sha256,integrity_sha256,option_orders,expires_at")
    .eq("id", attemptId).maybeSingle();
  if (ae) throw new Error("Attempt lookup failed: " + ae.message);
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) throw new Error("Assessment attempt does not belong to this student");
  if (!attempt.expires_at || !Number.isFinite(Date.parse(attempt.expires_at))) throw new Error("Assessment attempt has an invalid deadline");
  if (Date.now() >= Date.parse(attempt.expires_at)) throw new Error("Assessment attempt time has expired");

  if (!attempt.integrity_sha256 || await attemptIntegrityHash(attempt) !== attempt.integrity_sha256) throw new Error("Assessment attempt integrity check failed");
  await verifyActiveEnrollment(studentId, attempt.course_id, token);
  if (attempt.status !== "in_progress") throw new Error("Assessment attempt is no longer active");

  const startedAtMs = Date.parse(attempt.started_at);
  if (!Number.isFinite(startedAtMs)) throw new Error("Assessment attempt has an invalid start time");

  const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
  if (!ids.length || ids.some((x: unknown) => typeof x !== "string") || new Set(ids).size !== ids.length) {
    throw new Error("Assessment attempt has invalid question set");
  }

  const { data: answers, error: ansErr } = await supabase.from("assessment_answers")
    .select("question_id,answer,selected_option_index,answered_at").eq("attempt_id", attemptId);
  if (ansErr) throw new Error("Answer lookup failed: " + ansErr.message);

  const registry = await downloadJson("assessments/registry.json", "registry");
  const definition = registry.assessments?.[attempt.assessment_id];
  if (!definition || definition.status !== "published") throw new Error("Assessment is not published");
  if (attempt.release_version !== definition.release_version || attempt.release_public_sha256 !== definition.release_public_sha256 || attempt.release_private_sha256 !== definition.release_private_sha256) throw new Error("Assessment release changed after this attempt started; the attempt is locked to its original release");
  if (definition.course_id !== attempt.course_id || definition.domain !== attempt.domain || definition.kind !== attempt.kind) {
    throw new Error("Assessment definition does not match attempt");
  }
  if (!Number.isInteger(definition.time_seconds) || definition.time_seconds <= 0) {
    throw new Error("Assessment time limit is invalid");
  }
  if (Date.now() > startedAtMs + definition.time_seconds * 1000) {
    throw new Error("Assessment time has expired");
  }\n\n  const publicBankForIntegrity = await loadJson(definition.question_bank_public, "public question bank");\n  await verifyRegisteredBank(definition, publicBankForIntegrity);

  const publicParsed = await downloadJson(definition.question_bank_public, "public question bank");
  const publicQuestions = Array.isArray(publicParsed) ? publicParsed : publicParsed?.questions;
  if (!Array.isArray(publicQuestions)) throw new Error("Invalid public assessment question bank");
  const publicById = new Map(publicQuestions.map((q: any) => [q.question_id, q]));

  const keyParsed = await downloadJson(definition.answer_key, "answer key");
  await verifyRegisteredBank(definition, publicParsed, keyParsed);
  const answerEntries = Array.isArray(keyParsed) ? keyParsed : keyParsed?.questions || keyParsed?.answers;
  if (!Array.isArray(answerEntries)) throw new Error("Invalid private assessment answer key");
  const keyById = new Map(answerEntries.map((q: any) => [q.question_id, q]));

  let score = 0;
  let maxScore = 0;
  let answeredCount = 0;
  const updates: any[] = [];

  for (const questionId of ids) {
    const publicQuestion = publicById.get(questionId);
    const key = keyById.get(questionId);
    if (!publicQuestion || !key) throw new Error("Question or answer key entry missing: " + questionId);
    if (Object.prototype.hasOwnProperty.call(publicQuestion, "correct_option_index") ||
        Object.prototype.hasOwnProperty.call(publicQuestion, "explanation")) {
      throw new Error("Public question contains private scoring fields: " + questionId);
    }

    const marks = Number(key.marks ?? publicQuestion.marks);
    const correct = Number(key.correct_option_index);
    const explanation = typeof key.explanation === "string" ? key.explanation : "";
    if (!Number.isFinite(marks) || marks <= 0) throw new Error("Invalid marks for " + questionId);
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) throw new Error("Invalid answer key for " + questionId);
    if (explanation.length < 12) throw new Error("Missing explanation for " + questionId);
    maxScore += marks;

    const answer = (answers || []).find((a: any) => a.question_id === questionId);
    const selected = answer?.selected_option_index;
    const hasAnswer = Number.isInteger(selected) && selected >= 0 && selected <= 3;
    if (hasAnswer) answeredCount++;
    const isCorrect = hasAnswer && selected === correct;
    const awarded = isCorrect ? marks : 0;
    score += awarded;

    updates.push({
      attempt_id: attemptId, question_id: questionId,
      answer: typeof answer?.answer === "string" ? answer.answer : "",
      selected_option_index: hasAnswer ? selected : null,
      is_correct: isCorrect, correct_option_index: correct,
      explanation, marks_awarded: awarded,
      answered_at: answer?.answered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  // Score and correctness are derived exclusively from the private key above; client fields are never accepted.
  const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_assessment_attempt_result", {
    p_attempt_id: attemptId,
    p_student_id: studentId,
    p_score: score,
    p_max_score: maxScore,
    p_answered_count: answeredCount,
    p_submitted_at: now,
    p_scored_at: now,
  });
  if (finalizeError || !finalized) {
    if (finalizeError?.message?.includes("ASSESSMENT_ATTEMPT_NOT_ACTIVE")) throw new Error("Assessment was already submitted or is no longer active");
    if (finalizeError?.message?.includes("ASSESSMENT_ATTEMPT_EXPIRED")) throw new Error("Assessment attempt time has expired");
    throw new Error("Unable to finalize assessment: " + (finalizeError?.message || "finalization failed"));
  }

  return { attempt_id: attemptId, status: "submitted", score, max_score: maxScore, answered_count: answeredCount, submitted_at: now, scored_at: now };
}

function headers() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...headers(), "Content-Type": "application/json" } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers() });
  try {
    const auth = await uid(request.headers.get("Authorization"));
    const body = await request.json();
    if ((body?.action || "submit") !== "submit") return response({ error: "Unsupported action" }, 400);
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    if (!attemptId) return response({ error: "attempt_id is required" }, 400);
    return response(await submit(attemptId, auth.uid, auth.token));
  } catch (error) {
    console.error("assessment-submit error", error);
    return response({ error: error instanceof Error ? error.message : "Unable to submit assessment" }, 400);
  }
});
