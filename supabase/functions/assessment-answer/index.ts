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
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SECRET_KEYS["default"] || "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

async function verifyFirebaseToken(
  authorization: string | null,
): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token");
  }
  if (!FIREBASE_PROJECT_ID) {
    throw new Error("Firebase project configuration missing");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw new Error("Invalid Firebase token");
  return uid;
}

async function saveAnswer(
  studentId: string,
  attemptId: string,
  questionId: string,
  answer: string,
  selectedOptionIndex: number | null,
) {
  const { data: attempt, error: attemptError } = await supabase
    .from("assessment_attempts")
    .select("id,student_id,status,question_ids")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Attempt lookup failed: ${attemptError.message}`);
  }
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) {
    throw new Error("Assessment attempt does not belong to this student");
  }
  if (attempt.status !== "in_progress") {
    throw new Error("Assessment attempt is no longer active");
  }

  const questionIds = Array.isArray(attempt.question_ids)
    ? attempt.question_ids.filter((id: unknown): id is string =>
        typeof id === "string"
      )
    : [];

  if (!questionIds.includes(questionId)) {
    throw new Error("Question does not belong to this assessment attempt");
  }

  if (selectedOptionIndex !== null &&
      (!Number.isInteger(selectedOptionIndex) ||
       selectedOptionIndex < 0 ||
       selectedOptionIndex > 3)) {
    throw new Error("selected_option_index must be between 0 and 3");
  }

  const normalizedAnswer = answer.trim();
  if (normalizedAnswer.length > 2000) {
    throw new Error("Answer is too long");
  }

  const { data, error } = await supabase
    .from("assessment_answers")
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        answer: normalizedAnswer,
        selected_option_index: selectedOptionIndex,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" },
    )
    .select("question_id,answer,selected_option_index,answered_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Unable to save answer: ${error.message}`);
  }

  return {
    attempt_id: attemptId,
    answer: data,
    saved: true,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const studentId = await verifyFirebaseToken(
      request.headers.get("Authorization"),
    );
    const body = await request.json();

    if ((body?.action || "save_answer") !== "save_answer") {
      return jsonResponse({ error: "Unsupported action" }, 400);
    }

    const attemptId =
      typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    const questionId =
      typeof body?.question_id === "string" ? body.question_id.trim() : "";
    const answer =
      typeof body?.answer === "string" ? body.answer : "";
    const selectedOptionIndex =
      body?.selected_option_index === null ||
      body?.selected_option_index === undefined
        ? null
        : body.selected_option_index;

    if (!attemptId || !questionId) {
      return jsonResponse(
        { error: "attempt_id and question_id are required" },
        400,
      );
    }

    return jsonResponse(
      await saveAnswer(
        studentId,
        attemptId,
        questionId,
        answer,
        selectedOptionIndex,
      ),
    );
  } catch (error) {
    console.error("assessment-answer error", error);
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to save assessment answer",
      },
      400,
    );
  }
});
