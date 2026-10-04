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
const COMPETITION = "Thirukkural Mastery Championship";
const PER_ATTEMPT = 30;
const CACHE_TTL_HOURS = 12;
const AGE_POOLS_PATH =
  "competitions/thirukkural/objective/age-pools.json";

type AgeBand = "up_to_8" | "age_9_12" | "age_13_15" | "age_16_plus";
type AgePoolQuestion = string | { id?: string; question_id?: string; [key: string]: unknown };
type AgePools = Record<string, Record<string, AgePoolQuestion[]>>;

const BLUEPRINT: Record<AgeBand, Array<[string, number]>> = {
  up_to_8: [["Complete second line", 15], ["Identify Paal", 15]],
  age_9_12: [
    ["Complete second line", 5], ["Identify Paal", 5],
    ["Complete Kural", 8], ["Identify Adhigaram", 3],
    ["Identify Iyal", 3], ["Chapter range", 6],
  ],
  age_13_15: [
    ["Complete Kural", 5], ["Identify Adhigaram", 5],
    ["Identify Iyal", 4], ["Chapter range", 2],
    ["Source meaning identification", 7], ["Identify source meaning", 7],
  ],
  age_16_plus: [
    ["Complete Kural", 3], ["Identify Adhigaram", 4],
    ["Identify Iyal", 3], ["Chapter range", 2],
    ["Source meaning identification", 9], ["Identify source meaning", 9],
  ],
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const firebaseJWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function verifyFirebaseUser(request: Request): Promise<string> {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) {
    throw new Error("Authentication required");
  }
  const { payload } = await jwtVerify(header.slice(7).trim(), firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function getAccess(studentId: string) {
  const { data, error } = await supabase
    .from("competition_access_cache")
    .select("student_id,course_id,is_admin,enrolment_active,date_of_birth,checked_at")
    .eq("student_id", studentId).eq("course_id", COURSE_ID).maybeSingle();

  if (error) throw new Error(`Access lookup failed: ${error.message}`);
  if (!data || (!data.is_admin && !data.enrolment_active) || !data.date_of_birth) return false;

  const checked = new Date(data.checked_at).getTime();
  if (!Number.isFinite(checked) || Date.now() - checked > CACHE_TTL_HOURS * 60 * 60 * 1000) return false;

  const dob = new Date(`${String(data.date_of_birth)}T00:00:00.000Z`);
  const now = new Date();
  const oldest = new Date(now);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);
  return Number.isFinite(dob.getTime()) && dob <= now && dob >= oldest
    ? String(data.date_of_birth)
    : false;
}

function calculateAge(dateOfBirth: string) {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const month = now.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

function getAgeBand(age: number): AgeBand {
  if (age <= 8) return "up_to_8";
  if (age <= 12) return "age_9_12";
  if (age <= 15) return "age_13_15";
  return "age_16_plus";
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getQuestionId(question: AgePoolQuestion) {
  if (typeof question === "string") return question.trim();
  return typeof question.id === "string" ? question.id.trim()
    : typeof question.question_id === "string" ? question.question_id.trim() : "";
}

function selectQuestions(pools: AgePools, ageBand: AgeBand): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const [topic, count] of BLUEPRINT[ageBand]) {
    const pool = pools?.[ageBand]?.[topic];
    if (!Array.isArray(pool)) throw new Error(`Missing age pool: ${ageBand}/${topic}`);

    let added = 0;
    for (const item of shuffle(pool)) {
      const id = getQuestionId(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      selected.push(id);
      if (++added === count) break;
    }
    if (added !== count) throw new Error(`Insufficient unique questions for ${ageBand}/${topic}`);
  }

  if (selected.length !== PER_ATTEMPT || seen.size !== PER_ATTEMPT) {
    throw new Error("Question selection did not produce 30 unique questions");
  }
  return shuffle(selected);
}

async function loadAgePools(): Promise<AgePools> {
  const { data, error } = await supabase.storage.from(BUCKET).download(AGE_POOLS_PATH);
  if (error || !data) throw new Error("Unable to load competition question pools");
  return JSON.parse(await data.text()) as AgePools;
}

async function activeAttempt(studentId: string) {
  const { data, error } = await supabase
    .from("competition_attempts")
    .select("id,student_id,course_id,status,started_at,question_ids")
    .eq("student_id", studentId).eq("course_id", COURSE_ID)
    .eq("status", "in_progress").maybeSingle();
  if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const studentId = await verifyFirebaseUser(request);
    const dob = await getAccess(studentId);
    if (!dob) return json({ error: "You do not have access to this competition." }, 403);

    const existing = await activeAttempt(studentId);
    if (existing) {
      return json({ ok: true, course_id: COURSE_ID, competition: COMPETITION,
        attempt_id: existing.id, status: existing.status, started_at: existing.started_at,
        question_ids: existing.question_ids });
    }

    const age = calculateAge(dob);
    if (age < 0 || age > 120) return json({ error: "Invalid date of birth." }, 400);

    const ageBand = getAgeBand(age);
    const agePools = await loadAgePools();
    const questionIds = selectQuestions(agePools, ageBand);

    const { data, error } = await supabase.from("competition_attempts").insert({
      student_id: studentId,
      course_id: COURSE_ID,
      status: "in_progress",
      started_at: new Date().toISOString(),
      question_ids: questionIds,
    }).select("id,student_id,course_id,status,started_at,question_ids").single();

    if (error) {
      if (error.code === "23505") {
        const raced = await activeAttempt(studentId);
        if (raced) return json({ ok: true, course_id: COURSE_ID, competition: COMPETITION,
          attempt_id: raced.id, status: raced.status, started_at: raced.started_at,
          question_ids: raced.question_ids });
      }
      throw new Error(`Unable to create competition attempt: ${error.message}`);
    }

    return json({ ok: true, course_id: COURSE_ID, competition: COMPETITION,
      age_band: ageBand, attempt_id: data.id, status: data.status,
      started_at: data.started_at, question_ids: data.question_ids, count: PER_ATTEMPT });
  } catch (error) {
    console.error("competition-official-attempt error:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to start competition." }, 400);
  }
});
