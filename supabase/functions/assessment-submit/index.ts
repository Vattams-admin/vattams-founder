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
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`, audience: FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function submit(attemptId: string, studentId: string) {
  const { data: attempt, error: ae } = await supabase.from("assessment_attempts")
    .select("id,student_id,course_id,assessment_id,domain,kind,status,question_ids,is_mock")
    .eq("id", attemptId).maybeSingle();
  if (ae) throw new Error(`Attempt lookup failed: ${ae.message}`);
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) throw new Error("Assessment attempt does not belong to this student");
  if (attempt.status !== "in_progress") throw new Error("Assessment attempt is no longer active");

  const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Assessment attempt has invalid question set");

  const { data: answers, error: ansErr } = await supabase.from("assessment_answers")
    .select("question_id,answer,selected_option_index").eq("attempt_id", attemptId);
  if (ansErr) throw new Error(`Answer lookup failed: ${ansErr.message}`);

  const { data: registryFile, error: regErr } = await supabase.storage.from("academia-course-materials").download("assessments/registry.json");
  if (regErr || !registryFile) throw new Error("Unable to load assessment registry");
  const registry = JSON.parse(await registryFile.text());
  const definition = registry.assessments?.[attempt.assessment_id];
  if (!definition || definition.status !== "enabled") throw new Error("Assessment is not enabled");

  const { data: bankFile, error: bankErr } = await supabase.storage.from("academia-course-materials").download(definition.question_bank);
  if (bankErr || !bankFile) throw new Error("Unable to load assessment question bank");
  const parsed = JSON.parse(await bankFile.text());
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(questions)) throw new Error("Invalid assessment question bank");

  const byId = new Map(questions.map((q: any) => [q.question_id, q]));
  let score = 0;
  let maxScore = 0;
  let answeredCount = 0;
  const updates: any[] = [];

  for (const questionId of ids) {
    const q = byId.get(questionId);
    if (!q) throw new Error(`Question missing from bank: ${questionId}`);
    const marks = Number(q.marks);
    if (!Number.isFinite(marks) || marks <= 0) throw new Error(`Invalid marks for ${questionId}`);
    maxScore += marks;

    const answer = (answers || []).find((a: any) => a.question_id === questionId);
    const selected = answer?.selected_option_index;
    const correct = Number(q.correct_option_index);
    const hasAnswer = Number.isInteger(selected) && selected >= 0 && selected <= 3;
    if (hasAnswer) answeredCount++;
    const isCorrect = hasAnswer && selected === correct;
    const awarded = isCorrect ? marks : 0;
    score += awarded;

    updates.push({
      attempt_id: attemptId, question_id: questionId,
      answer: typeof answer?.answer === "string" ? answer.answer : "",
      selected_option_index: hasAnswer ? selected : null,
      is_correct: isCorrect,
      correct_option_index: correct,
      explanation: typeof q.explanation === "string" ? q.explanation : null,
      marks_awarded: awarded,
      answered_at: answer?.answered_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase.from("assessment_answers").upsert(updates, { onConflict: "attempt_id,question_id" });
  if (upErr) throw new Error(`Unable to persist scored answers: ${upErr.message}`);

  const { data: updated, error: attemptErr } = await supabase.from("assessment_attempts")
    .update({ status: "submitted", score, max_score: maxScore, submitted_at: now, scored_at: now, updated_at: now })
    .eq("id", attemptId).eq("student_id", studentId).eq("status", "in_progress").select("id").maybeSingle();
  if (attemptErr) throw new Error(`Unable to submit assessment: ${attemptErr.message}`);
  if (!updated) throw new Error("Assessment was already submitted");

  const { error: resultErr } = await supabase.from("assessment_results").insert({
    student_id: studentId, attempt_id: attemptId, course_id: attempt.course_id,
    assessment_id: attempt.assessment_id, domain: attempt.domain, score, max_score: maxScore,
    answered_count: answeredCount, submitted_at: now, scored_at: now, is_mock: attempt.is_mock,
  });
  if (resultErr) throw new Error(`Unable to create assessment result: ${resultErr.message}`);

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
