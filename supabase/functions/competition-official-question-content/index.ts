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
  "competitions/thirukkural/objective/official-30.questions.private.json";

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
  if (!header.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) {
    throw new Error("Authentication required");
  }
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

function validQuestion(question: any, id: string) {
  return !!question &&
    question.question_id === id &&
    question.course_id === COURSE_ID &&
    question.question_type === "Multiple Choice" &&
    typeof question.question === "string" &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    new Set(question.options.map(String)).size === 4 &&
    question.options.every((x: unknown) => typeof x === "string" && x.trim());
}

async function loadBundle() {
  const { data, error } = await supabase.storage.from(BUCKET).download(QUESTION_BUNDLE);
  if (error || !data) throw new Error("Official question bundle is unavailable.");
  const parsed = JSON.parse(await data.text());
  if (!parsed || parsed.course_id !== COURSE_ID || !parsed.questions) {
    throw new Error("Official question bundle is invalid.");
  }
  return parsed.questions as Record<string, any>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const studentId = await uid(request);
    const body = await request.json();
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    const questionIds = Array.isArray(body?.question_ids)
      ? body.question_ids.filter((x: unknown): x is string => typeof x === "string" && x.trim())
      : [];

    if (!attemptId || questionIds.length !== 30 || new Set(questionIds).size !== 30) {
      return json({ error: "Valid 30-question attempt is required." }, 400);
    }

    const { data: attempt, error: attemptError } = await supabase
      .from("competition_attempts")
      .select("id,student_id,course_id,status,question_ids")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError) throw new Error(`Attempt lookup failed: ${attemptError.message}`);
    if (!attempt || attempt.student_id !== studentId || attempt.course_id !== COURSE_ID) {
      return json({ error: "This competition attempt is not available." }, 403);
    }
    if (attempt.status !== "in_progress") {
      return json({ error: "This competition attempt is no longer active." }, 409);
    }

    const saved = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
    if (saved.length !== 30 || new Set(saved).size !== 30 ||
        questionIds.some((id) => !saved.includes(id))) {
      return json({ error: "Requested questions do not belong to this attempt." }, 400);
    }

    const questions = await loadBundle();
    const selected = questionIds.map((id) => questions[id]);

    if (selected.some((q, i) => !validQuestion(q, questionIds[i]))) {
      return json({ error: "One or more official questions are unavailable." }, 409);
    }

    return json({
      ok: true,
      course_id: COURSE_ID,
      count: selected.length,
      questions: selected.map((q) => ({
        question_id: q.question_id,
        course_id: q.course_id,
        question: q.question,
        question_type: q.question_type,
        topic: q.topic || "",
        subtopic: q.subtopic || "",
        options: q.options,
        marks: Number(q.marks) || 1,
        time_seconds: Number(q.time_seconds) || 60,
      })),
    });
  } catch (error) {
    console.error("competition-official-question-content error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unable to load official questions.",
    }, 400);
  }
});
