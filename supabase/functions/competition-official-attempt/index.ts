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

const COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const COMPETITION = "Thirukkural Mastery Championship";
const PER_ATTEMPT = 30;
const CACHE_TTL_HOURS = 12;

const OFFICIAL_QUESTION_IDS = [
  ...Array.from({ length: 8 }, (_, i) => `TKR-REC-${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, i) => `TKR-ADH-${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 8 }, (_, i) => `TKR-MEAN-${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, i) => `TKR-KNOW-${String(i + 1).padStart(2, "0")}`),
];

if (
  OFFICIAL_QUESTION_IDS.length !== PER_ATTEMPT ||
  new Set(OFFICIAL_QUESTION_IDS).size !== PER_ATTEMPT
) {
  throw new Error("Invalid official Thirukkural question set");
}

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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function verifyFirebaseUser(request: Request): Promise<string> {
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

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Invalid Firebase token");
  }

  return payload.sub;
}

async function getAccess(studentId: string) {
  const { data, error } = await supabase
    .from("competition_access_cache")
    .select(
      "student_id,course_id,is_admin,enrolment_active,date_of_birth,checked_at",
    )
    .eq("student_id", studentId)
    .eq("course_id", COURSE_ID)
    .maybeSingle();

  if (error) throw new Error(`Access lookup failed: ${error.message}`);
  if (!data || (!data.is_admin && !data.enrolment_active) || !data.date_of_birth) {
    return false;
  }

  const checked = new Date(data.checked_at).getTime();
  if (
    !Number.isFinite(checked) ||
    checked > Date.now() + 60_000 ||
    Date.now() - checked > CACHE_TTL_HOURS * 60 * 60 * 1000
  ) {
    return false;
  }

  const dob = new Date(`${String(data.date_of_birth)}T00:00:00.000Z`);
  const now = new Date();
  const oldest = new Date(now);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);

  if (!Number.isFinite(dob.getTime()) || dob > now || dob < oldest) {
    return false;
  }

  return String(data.date_of_birth);
}

async function activeAttempt(studentId: string) {
  const { data, error } = await supabase
    .from("competition_attempts")
    .select("id,student_id,course_id,status,started_at,question_ids")
    .eq("student_id", studentId)
    .eq("course_id", COURSE_ID)
    .eq("status", "in_progress")
    .maybeSingle();

  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data;
}

function validQuestionSet(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === PER_ATTEMPT &&
    new Set(value).size === PER_ATTEMPT &&
    value.every((id) => typeof id === "string" && OFFICIAL_QUESTION_IDS.includes(id))
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const studentId = await verifyFirebaseUser(request);
    const dob = await getAccess(studentId);

    if (!dob) {
      return json(
        { error: "You do not have access to this competition." },
        403,
      );
    }

    const existing = await activeAttempt(studentId);
    if (existing) {
      if (!validQuestionSet(existing.question_ids)) {
        return json(
          { error: "Existing official attempt has an invalid question set." },
          409,
        );
      }

      return json({
        ok: true,
        course_id: COURSE_ID,
        competition: COMPETITION,
        attempt_id: existing.id,
        status: existing.status,
        started_at: existing.started_at,
        question_ids: existing.question_ids,
        count: PER_ATTEMPT,
      });
    }

    const { data, error } = await supabase
      .from("competition_attempts")
      .insert({
        student_id: studentId,
        course_id: COURSE_ID,
        status: "in_progress",
        started_at: new Date().toISOString(),
        question_ids: OFFICIAL_QUESTION_IDS,
      })
      .select("id,student_id,course_id,status,started_at,question_ids")
      .single();

    if (error) {
      if (error.code === "23505") {
        const raced = await activeAttempt(studentId);
        if (raced && validQuestionSet(raced.question_ids)) {
          return json({
            ok: true,
            course_id: COURSE_ID,
            competition: COMPETITION,
            attempt_id: raced.id,
            status: raced.status,
            started_at: raced.started_at,
            question_ids: raced.question_ids,
            count: PER_ATTEMPT,
          });
        }
      }

      throw new Error(
        `Unable to create competition attempt: ${error.message}`,
      );
    }

    return json({
      ok: true,
      course_id: COURSE_ID,
      competition: COMPETITION,
      attempt_id: data.id,
      status: data.status,
      started_at: data.started_at,
      question_ids: data.question_ids,
      count: PER_ATTEMPT,
    });
  } catch (error) {
    console.error("competition-official-attempt error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start competition.",
      },
      400,
    );
  }
});
