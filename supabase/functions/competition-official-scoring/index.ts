import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
);
const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_SECRET_KEYS["default"] || "";
const BUCKET = "academia-course-materials";
const COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const QUESTION_BUNDLE =
  "competitions/thirukkural/objective/questions.private.json";
const ANSWER_BUNDLE =
  "competitions/thirukkural/objective/answer-keys.private.json";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function uid(request: Request) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) throw new Error("Authentication required");
  const { payload } = await jwtVerify(
    header.slice("Bearer ".length).trim(),
    firebaseJWKS,
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    },
  );
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function loadQuestions() {
  const { data, error } = await supabase.storage.from(BUCKET).download(QUESTION_BUNDLE);
  if (error || !data) throw new Error("Official question bundle is unavailable.");
  const parsed = JSON.parse(await data.text());
  if (!parsed || parsed.course_id !== COURSE_ID || !parsed.questions || typeof parsed.questions !== "object") {
    throw new Error("Official question bundle is invalid.");
  }
  return parsed.questions as Record<string, { time_seconds?: number }>;
}

async function loadKeys() {
  const { data, error } = await supabase.storage.from(BUCKET).download(ANSWER_BUNDLE);
  if (error || !data) throw new Error("Official answer-key bundle is unavailable.");
  const parsed = JSON.parse(await data.text());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Official answer-key bundle is invalid.");
  }
  return parsed as Record<string, { answer: string; correct_option_index?: number; explanation?: string }>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const studentId = await uid(request);
    const body = await request.json();
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    const submitted = Array.isArray(body?.answers) ? body.answers : [];

    if (!attemptId || submitted.length > 30) return json({ error: "Valid attempt and answers are required." }, 400);

    const { data: attempt, error: attemptError } = await supabase
      .from("competition_attempts")
      .select("id,student_id,course_id,status,started_at,question_ids")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError) throw new Error(`Attempt lookup failed: ${attemptError.message}`);
    if (!attempt || attempt.student_id !== studentId || attempt.course_id !== COURSE_ID) {
      return json({ error: "This competition attempt is not available." }, 403);
    }

    if (attempt.status === "submitted") {
      const { data: existing } = await supabase
        .from("competition_results")
        .select("score,max_score,answered_count")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      if (existing) return json({ ok: true, ...existing, submitted: true, alreadySubmitted: true });
      return json({ error: "This competition attempt has already been submitted." }, 409);
    }

    if (attempt.status !== "in_progress") return json({ error: "Invalid competition attempt status." }, 409);

    const questionIds = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
    if (questionIds.length !== 30 || new Set(questionIds).size !== 30) {
      return json({ error: "Competition attempt has an invalid question set." }, 409);
    }

    const questionBundle = await loadQuestions();
    let allowedSeconds = 0;
    for (const questionId of questionIds) {
      const question = questionBundle[questionId];
      if (!question) return json({ error: `Missing question content for ${questionId}` }, 409);
      allowedSeconds += Math.max(1, Number(question.time_seconds) || 60);
    }
    const startedAt = new Date(String(attempt.started_at)).getTime();
    if (!Number.isFinite(startedAt)) return json({ error: "Competition attempt has an invalid start time." }, 409);
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsedSeconds > allowedSeconds + 30) {
      return json({ error: "Competition time has expired." }, 409);
    }

    const answerMap = new Map<string, string>();
    for (const item of submitted) {
      const questionId = typeof item?.questionId === "string" ? item.questionId.trim() : "";
      const answer = typeof item?.answer === "string" ? item.answer.trim() : "";
      if (!questionId || !questionIds.includes(questionId)) {
        return json({ error: "Submitted answer contains an invalid question." }, 400);
      }
      if (answerMap.has(questionId)) return json({ error: `Duplicate answer for ${questionId}` }, 400);
      answerMap.set(questionId, answer);
    }

    const keys = await loadKeys();
    let score = 0;
    let maxScore = 0;
    let answeredCount = 0;
    const answerRows = [];

    for (const questionId of questionIds) {
      const key = keys[questionId];
      if (!key || typeof key.answer !== "string") {
        return json({ error: `Missing answer key for ${questionId}` }, 409);
      }

      const answer = answerMap.get(questionId) || "";
      const correct = answer !== "" &&
        answer.trim().toLowerCase().replace(/\s+/g, " ") ===
        key.answer.trim().toLowerCase().replace(/\s+/g, " ");

      maxScore += 1;
      if (answer !== "") answeredCount += 1;
      if (correct) score += 1;

      answerRows.push({
        attempt_id: attemptId,
        question_id: questionId,
        answer,
        is_correct: correct,
        correct_answer: key.answer,
        correct_option_index: Number.isInteger(key.correct_option_index) ? key.correct_option_index : null,
        explanation: key.explanation || "",
        marks_awarded: correct ? 1 : 0,
        answered_at: answer ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: answerError } = await supabase
      .from("competition_answers")
      .upsert(answerRows, { onConflict: "attempt_id,question_id" });
    if (answerError) throw new Error(`Unable to save competition answers: ${answerError.message}`);

    const now = new Date().toISOString();
    const { data: result, error: resultError } = await supabase
      .from("competition_results")
      .insert({
        student_id: studentId,
        attempt_id: attemptId,
        course_id: COURSE_ID,
        score,
        max_score: maxScore,
        answered_count: answeredCount,
        submitted_at: now,
        scored_at: now,
      })
      .select("score,max_score,answered_count")
      .single();

    if (resultError) {
      if (resultError.code === "23505") {
        const { data: existing } = await supabase
          .from("competition_results")
          .select("score,max_score,answered_count")
          .eq("attempt_id", attemptId)
          .maybeSingle();
        if (existing) {
          await supabase.from("competition_attempts").update({
            status: "submitted",
            score: existing.score,
            max_score: existing.max_score,
            submitted_at: now,
            scored_at: now,
            updated_at: now,
          }).eq("id", attemptId).eq("student_id", studentId);
          return json({ ok: true, ...existing, submitted: true, alreadySubmitted: true });
        }
      }
      throw new Error(`Unable to save competition result: ${resultError.message}`);
    }

    const { error: attemptUpdateError } = await supabase
      .from("competition_attempts")
      .update({
        status: "submitted",
        score,
        max_score: maxScore,
        submitted_at: now,
        scored_at: now,
        updated_at: now,
      })
      .eq("id", attemptId)
      .eq("student_id", studentId)
      .eq("status", "in_progress");

    if (attemptUpdateError) throw new Error(`Unable to finalize competition attempt: ${attemptUpdateError.message}`);

    return json({
      ok: true,
      attemptId,
      score,
      maxScore,
      answeredCount,
      submitted: true,
      alreadySubmitted: false,
    });
  } catch (error) {
    console.error("competition-official-scoring error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to submit competition.",
    }, 400);
  }
});
