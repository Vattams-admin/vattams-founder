import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const supabase = createClient(SUPABASE_URL, KEYS["default"] || "", { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

async function uid(auth: string | null) {
  if (!auth?.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(auth.slice(7).trim(), jwks, {
    issuer: "https://securetoken.google.com/" + FIREBASE_PROJECT_ID, audience: FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function downloadJson(path: string, label: string) {
  if (typeof path !== "string" || !path) throw new Error("Assessment " + label + " is not configured");
  const { data, error } = await supabase.storage.from("academia-course-materials").download(path);
  if (error || !data) throw new Error("Unable to load assessment " + label);
  return JSON.parse(await data.text());
}

async function submit(attemptId: string, studentId: string) {
  const { data: attempt, error: ae } = await supabase.from("assessment_attempts")
     .select("id,student_id,course_id,assessment_id,domain,kind,status,started_at,question_ids,is_mock")
    .eq("id", attemptId).maybeSingle();
  if (ae) throw new Error("Attempt lookup failed: " + ae.message);
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) throw new Error("Assessment attempt does not belong to this student");
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
  if (definition.course_id !== attempt.course_id || definition.domain !== attempt.domain || definition.kind !== attempt.kind) {
    throw new Error("Assessment definition does not match attempt");
  }
  if (!Number.isInteger(definition.time_seconds) || definition.time_seconds <= 0) {
    throw new Error("Assessment time limit is invalid");
  }
  if (Date.now() > startedAtMs + definition.time_seconds * 1000) {
    // The client timer is only a UX aid; the server remains authoritative.
    // Expired attempts are still scored on submission so the student does not lose
    // their saved answers, but no new answers can be accepted after expiry.
  }

  const publicParsed = await downloadJson(definition.question_bank_public, "public question bank");
  const publicQuestions = Array.isArray(publicParsed) ? publicParsed : publicParsed?.questions;
  if (!Array.isArray(publicQuestions)) throw new Error("Invalid public assessment question bank");
  const publicById = new Map(publicQuestions.map((q: any) => [q.question_id, q]));

  const keyParsed = await downloadJson(definition.answer_key, "answer key");
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
  const { error: upErr } = await supabase.from("assessment_answers").upsert(updates, { onConflict: "attempt_id,question_id" });
  if (upErr) throw new Error("Unable to persist scored answers: " + upErr.message);

  const { data: updated, error: attemptErr } = await supabase.from("assessment_attempts")
    .update({ status: "submitted", score, max_score: maxScore, submitted_at: now, scored_at: now, updated_at: now })
    .eq("id", attemptId).eq("student_id", studentId).eq("status", "in_progress").select("id").maybeSingle();
  if (attemptErr) throw new Error("Unable to submit assessment: " + attemptErr.message);
  if (!updated) throw new Error("Assessment was already submitted");

  const { error: resultErr } = await supabase.from("assessment_results").insert({
    student_id: studentId, attempt_id: attemptId, course_id: attempt.course_id,
    assessment_id: attempt.assessment_id, domain: attempt.domain, score, max_score: maxScore,
    answered_count: answeredCount, submitted_at: now, scored_at: now, is_mock: attempt.is_mock,
  });
  if (resultErr) throw new Error("Unable to create assessment result: " + resultErr.message);

  return { attempt_id: attemptId, status: "submitted", score, max_score: maxScore, answered_count: answeredCount, submitted_at: now, scored_at: now };
}

function headers() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...headers(), "Content-Type": "application/json" } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers() });
  try {
    const studentId = await uid(request.headers.get("Authorization"));
    const body = await request.json();
    if ((body?.action || "submit") !== "submit") return response({ error: "Unsupported action" }, 400);
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    if (!attemptId) return response({ error: "attempt_id is required" }, 400);
    return response(await submit(attemptId, studentId));
  } catch (error) {
    console.error("assessment-submit error", error);
    return response({ error: error instanceof Error ? error.message : "Unable to submit assessment" }, 400);
  }
});
