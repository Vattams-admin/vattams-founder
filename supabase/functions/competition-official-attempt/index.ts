import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SECRET_KEYS["default"] || "";

const COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const COMPETITION = "Thirukkural Mastery Championship";
const PER_ATTEMPT = 30;
// Access sync runs every 30 minutes; keep the authorization cache bounded to 1 hour so revocations cannot remain effective for half a day.
const CACHE_TTL_HOURS = 1;

const OFFICIAL_PAPERS = {
  up_to_8: Array.from({ length: 30 }, (_, i) => `TKR-U8-${String(i + 1).padStart(2, "0")}`),
  age_9_12: Array.from({ length: 30 }, (_, i) => `TKR-A9-12-${String(i + 1).padStart(2, "0")}`),
  age_13_15: Array.from({ length: 30 }, (_, i) => `TKR-A13-15-${String(i + 1).padStart(2, "0")}`),
  age_16_plus: [
    ...Array.from({ length: 8 }, (_, i) => `TKR-REC-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 7 }, (_, i) => `TKR-ADH-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 8 }, (_, i) => `TKR-MEAN-${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 7 }, (_, i) => `TKR-KNOW-${String(i + 1).padStart(2, "0")}`),
  ],
} as const;

function validPaper(ids: readonly string[]) {
  return ids.length === PER_ATTEMPT && new Set(ids).size === PER_ATTEMPT;
}
if (!Object.values(OFFICIAL_PAPERS).every(validPaper)) throw new Error("Invalid official Thirukkural paper configuration");

const ALL_OFFICIAL_IDS = new Set(Object.values(OFFICIAL_PAPERS).flat());

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const firebaseJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
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

function ageOnToday(dob: string) {
  const birth = new Date(`${dob}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function paperForAge(age: number): { ageBand: keyof typeof OFFICIAL_PAPERS; questionIds: readonly string[] } {
  if (age <= 8) return { ageBand: "up_to_8", questionIds: OFFICIAL_PAPERS.up_to_8 };
  if (age <= 12) return { ageBand: "age_9_12", questionIds: OFFICIAL_PAPERS.age_9_12 };
  if (age <= 15) return { ageBand: "age_13_15", questionIds: OFFICIAL_PAPERS.age_13_15 };
  return { ageBand: "age_16_plus", questionIds: OFFICIAL_PAPERS.age_16_plus };
}

async function competitionEnabled() {
  const { data, error } = await supabase.storage
    .from("academia-course-materials")
    .download(REGISTRY_BUNDLE);
  if (error || !data) throw new Error("Competition registry is unavailable.");
  const registry = JSON.parse(await data.text());
  return registry?.competitions?.[COURSE_ID]?.enabled === true;
}

async function getAccess(studentId: string) {
  const { data, error } = await supabase.from("competition_access_cache")
    .select("student_id,course_id,is_admin,enrolment_active,date_of_birth,checked_at")
    .eq("student_id", studentId).eq("course_id", COURSE_ID).maybeSingle();
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
  return { dob: String(data.date_of_birth), ...paperForAge(age) };
}

async function activeAttempt(studentId: string) {
  const { data, error } = await supabase.from("competition_attempts")
    .select("id,student_id,course_id,status,started_at,question_ids")
    .eq("student_id", studentId).eq("course_id", COURSE_ID).eq("status", "in_progress").maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data;
}

function validQuestionSet(value: unknown, expected: readonly string[]): value is string[] {
  return Array.isArray(value) && value.length === PER_ATTEMPT &&
    new Set(value).size === PER_ATTEMPT &&
    value.every((id) => typeof id === "string" && expected.includes(id));
}

function responseFor(attempt: any, paper: ReturnType<typeof paperForAge>) {
  return {
    ok: true, course_id: COURSE_ID, competition: COMPETITION, attempt_id: attempt.id,
    status: attempt.status, started_at: attempt.started_at, question_ids: attempt.question_ids,
    count: PER_ATTEMPT, age_band: paper.ageBand,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const studentId = await verifyFirebaseUser(request);
    if (!(await competitionEnabled())) {
      return json({ error: "Competition is not enabled." }, 409);
    }
    const access = await getAccess(studentId);
    if (!access) return json({ error: "You do not have access to this competition." }, 403);

    const existing = await activeAttempt(studentId);
    if (existing) {
      const matchingPaper = Object.entries(OFFICIAL_PAPERS).find(([, ids]) => validQuestionSet(existing.question_ids, ids));
      if (!matchingPaper) {
        await supabase.from("competition_attempts").update({
          status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", existing.id).eq("student_id", studentId).eq("status", "in_progress");
      } else if (matchingPaper[0] === access.ageBand) {
        return responseFor(existing, access);
      } else {
        await supabase.from("competition_attempts").update({
          status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", existing.id).eq("student_id", studentId).eq("status", "in_progress");
      }
    }

    const { data, error } = await supabase.from("competition_attempts").insert({
      student_id: studentId, course_id: COURSE_ID, status: "in_progress",
      started_at: new Date().toISOString(), question_ids: access.questionIds,
    }).select("id,student_id,course_id,status,started_at,question_ids").single();

    if (error) {
      if (error.code === "23505") {
        const raced = await activeAttempt(studentId);
        if (raced && validQuestionSet(raced.question_ids, access.questionIds)) return responseFor(raced, access);
      }
      throw new Error(`Unable to create competition attempt: ${error.message}`);
    }
    return responseFor(data, access);
  } catch (error) {
    console.error("competition-official-attempt error:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to start competition." }, 400);
  }
});
