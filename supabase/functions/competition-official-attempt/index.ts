import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SECRET_KEYS["default"] || "";
const BUCKET = "academia-course-materials";
const REGISTRY_BUNDLE = "competitions/registry.json";
const PER_ATTEMPT = 30;
const CACHE_TTL_HOURS = 1;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const firebaseJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AgeBand = "up_to_8" | "age_9_12" | "age_13_15" | "age_16_plus";
type RegistryEntry = {
  course_id: string;
  competition: string;
  slug: string;
  question_bundle: string;
  answer_key_bundle: string;
  age_pools: string;
  per_attempt: number;
  official_papers?: Partial<Record<AgeBand, string[]>>;
  enabled: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function verifyFirebaseUser(request: Request): Promise<string> {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) throw new Error("Authentication required");
  const { payload } = await jwtVerify(header.slice("Bearer ".length).trim(), firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function loadRegistry(): Promise<Record<string, RegistryEntry>> {
  const { data, error } = await supabase.storage.from(BUCKET).download(REGISTRY_BUNDLE);
  if (error || !data) throw new Error("Competition registry is unavailable.");
  const parsed = JSON.parse(await data.text());
  if (!parsed?.competitions || typeof parsed.competitions !== "object") throw new Error("Competition registry is invalid.");
  return parsed.competitions as Record<string, RegistryEntry>;
}

function validatePaper(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === PER_ATTEMPT &&
    new Set(value).size === PER_ATTEMPT &&
    value.every((id) => typeof id === "string" && id.trim().length > 0);
}

async function loadCompetition(courseId: string): Promise<RegistryEntry> {
  const registry = await loadRegistry();
  const entry = registry[courseId];
  if (!entry || entry.enabled !== true) throw new Error("Competition is not enabled.");
  if (entry.course_id !== courseId || entry.per_attempt !== PER_ATTEMPT) throw new Error("Competition registry entry is invalid.");
  const papers = entry.official_papers;
  if (!papers || !(["up_to_8", "age_9_12", "age_13_15", "age_16_plus"] as AgeBand[]).every((band) => validatePaper(papers[band]))) {
    throw new Error("Competition official papers are not configured.");
  }
  if (!entry.question_bundle || !entry.answer_key_bundle) throw new Error("Competition runtime bundles are not configured.");
  return entry;
}

function ageOnToday(dob: string) {
  const birth = new Date(`${dob}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function paperForAge(age: number, papers: Record<AgeBand, string[]>) {
  if (age <= 8) return { ageBand: "up_to_8" as const, questionIds: papers.up_to_8 };
  if (age <= 12) return { ageBand: "age_9_12" as const, questionIds: papers.age_9_12 };
  if (age <= 15) return { ageBand: "age_13_15" as const, questionIds: papers.age_13_15 };
  return { ageBand: "age_16_plus" as const, questionIds: papers.age_16_plus };
}

async function getAccessForCompetition(studentId: string, courseId: string, competition: RegistryEntry) {
  const { data, error } = await supabase.from("competition_access_cache")
    .select("student_id,course_id,is_admin,enrolment_active,date_of_birth,checked_at")
    .eq("student_id", studentId).eq("course_id", courseId).maybeSingle();
  if (error) throw new Error(`Access lookup failed: ${error.message}`);
  if (!data || (!data.is_admin && !data.enrolment_active) || !data.date_of_birth) return false;
  const checked = new Date(data.checked_at).getTime();
  if (!Number.isFinite(checked) || checked > Date.now() + 60_000 || Date.now() - checked > CACHE_TTL_HOURS * 60 * 60 * 1000) return false;
  const dob = new Date(`${String(data.date_of_birth)}T00:00:00.000Z`);
  const now = new Date();
  const oldest = new Date(now);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);
  if (!Number.isFinite(dob.getTime()) || dob > now || dob < oldest) return false;
  const age = ageOnToday(String(data.date_of_birth));
  if (age < 0 || age > 120) return false;
  return { dob: String(data.date_of_birth), ...paperForAge(age, competition.official_papers as Record<AgeBand, string[]>) };
}

async function loadAttemptAnswers(attemptId: string) {
  const { data, error } = await supabase.from("competition_answers")
    .select("question_id,answer")
    .eq("attempt_id", attemptId);
  if (error) throw new Error("Answer lookup failed: " + error.message);
  return (data || []).map((row) => ({
    question_id: row.question_id,
    answer: row.answer || "",
  }));
}

async function activeAttempt(studentId: string, courseId: string) {
  const { data, error } = await supabase.from("competition_attempts")
    .select("id,student_id,course_id,status,started_at,question_ids")
    .eq("student_id", studentId).eq("course_id", courseId).eq("status", "in_progress").maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data;
}

function validQuestionSet(value: unknown, expected: readonly string[]): value is string[] {
  return Array.isArray(value) && value.length === PER_ATTEMPT && new Set(value).size === PER_ATTEMPT &&
    value.every((id) => typeof id === "string" && expected.includes(id));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const studentId = await verifyFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const courseId = typeof body?.course_id === "string" ? body.course_id.trim() : "";
    if (!courseId) return json({ error: "course_id is required." }, 400);
    const competition = await loadCompetition(courseId);
    const access = await getAccessForCompetition(studentId, courseId, competition);
    if (!access) return json({ error: "You do not have access to this competition." }, 403);

    const existing = await activeAttempt(studentId, courseId);
    if (existing) {
      if (validQuestionSet(existing.question_ids, access.questionIds)) {
        return json({ ok: true, course_id: courseId, competition: competition.competition, attempt_id: existing.id, status: existing.status, started_at: existing.started_at, question_ids: existing.question_ids, answers: await loadAttemptAnswers(existing.id), count: PER_ATTEMPT, age_band: access.ageBand });
      }
      await supabase.from("competition_attempts").update({
        status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", existing.id).eq("student_id", studentId).eq("status", "in_progress");
    }

    const { data, error } = await supabase.from("competition_attempts").insert({
      student_id: studentId, course_id: courseId, status: "in_progress",
      started_at: new Date().toISOString(), question_ids: access.questionIds,
    }).select("id,student_id,course_id,status,started_at,question_ids").single();

    if (error) {
      if (error.code === "23505") {
        const raced = await activeAttempt(studentId, courseId);
        if (raced && validQuestionSet(raced.question_ids, access.questionIds)) {
          return json({ ok: true, course_id: courseId, competition: competition.competition, attempt_id: raced.id, status: raced.status, started_at: raced.started_at, question_ids: raced.question_ids, count: PER_ATTEMPT, age_band: access.ageBand });
        }
      }
      throw new Error(`Unable to create competition attempt: ${error.message}`);
    }
    return json({ ok: true, course_id: courseId, competition: competition.competition, attempt_id: data.id, status: data.status, started_at: data.started_at, question_ids: data.question_ids, count: PER_ATTEMPT, age_band: access.ageBand });
  } catch (error) {
    console.error("competition-official-attempt error:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to start competition." }, 400);
  }
});
