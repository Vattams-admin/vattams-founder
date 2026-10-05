import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SERVICE_KEY = KEYS["default"] || "";
const BUCKET = "academia-course-materials";
const REGISTRY_BUNDLE = "competitions/registry.json";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const firebaseJWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

type RegistryEntry = { course_id: string; question_bundle: string; enabled: boolean; per_attempt: number };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function uid(req: Request) {
  const h = req.headers.get("Authorization") || "";
  if (!h.startsWith("Bearer ") || !FIREBASE_PROJECT_ID) throw new Error("Authentication required");
  const { payload } = await jwtVerify(h.slice(7).trim(), firebaseJWKS, { issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`, audience: FIREBASE_PROJECT_ID });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function loadRegistryEntry(courseId: string): Promise<RegistryEntry> {
  const { data, error } = await supabase.storage.from(BUCKET).download(REGISTRY_BUNDLE);
  if (error || !data) throw new Error("Competition registry is unavailable.");
  const registry = JSON.parse(await data.text());
  const entry = registry?.competitions?.[courseId] as RegistryEntry | undefined;
  if (!entry || entry.enabled !== true || entry.course_id !== courseId || entry.per_attempt !== 30 || !entry.question_bundle) {
    throw new Error("Competition runtime configuration is invalid.");
  }
  return entry;
}

async function loadBundle(bundlePath: string, courseId: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(bundlePath);
  if (error || !data) throw new Error("Competition question bundle is unavailable.");
  const parsed = JSON.parse(await data.text());
  if (!parsed || parsed.course_id !== courseId || !parsed.questions || typeof parsed.questions !== "object") {
    throw new Error("Competition question bundle is invalid.");
  }
  return parsed.questions as Record<string, any>;
}

function valid(q: any, id: string, courseId: string) {
  return !!q && q.question_id === id && q.course_id === courseId &&
    q.question_type === "Multiple Choice" && typeof q.question === "string" && q.question.trim() &&
    Array.isArray(q.options) && q.options.length === 4 && new Set(q.options.map(String)).size === 4 &&
    q.options.every((x: any) => typeof x === "string" && x.trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const studentId = await uid(req);
    const body = await req.json();
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    if (!attemptId) return json({ error: "attempt_id is required." }, 400);

    const { data: attempt, error } = await supabase.from("competition_attempts")
      .select("id,student_id,course_id,status,question_ids").eq("id", attemptId).maybeSingle();
    if (error) throw new Error(`Attempt lookup failed: ${error.message}`);
    if (!attempt || attempt.student_id !== studentId) return json({ error: "This competition attempt is not available." }, 403);
    if (attempt.status !== "in_progress") return json({ error: "This competition attempt is no longer active." }, 409);

    const entry = await loadRegistryEntry(attempt.course_id);
    const ids = Array.isArray(attempt.question_ids) ? attempt.question_ids : [];
    if (ids.length !== entry.per_attempt || new Set(ids).size !== entry.per_attempt) return json({ error: "Competition attempt has an invalid question set." }, 409);
    const requested = Array.isArray(body?.question_ids) ? body.question_ids.filter((x: unknown): x is string => typeof x === "string" && x.trim()) : ids;
    if (requested.length !== entry.per_attempt || new Set(requested).size !== entry.per_attempt || requested.some((id: string) => !ids.includes(id))) {
      return json({ error: "Requested questions do not belong to this attempt." }, 400);
    }

    const bundle = await loadBundle(entry.question_bundle, attempt.course_id);
    const selected = requested.map((id: string) => bundle[id]);
    if (selected.some((q: any, i: number) => !valid(q, requested[i], attempt.course_id))) {
      return json({ error: "One or more selected questions are unavailable." }, 409);
    }

    return json({
      ok: true,
      course_id: attempt.course_id,
      count: entry.per_attempt,
      questions: selected.map((q: any) => ({
        question_id: q.question_id, course_id: q.course_id, age_band: q.age_band || "",
        topic: q.topic || "", subtopic: q.subtopic || "", question: q.question,
        question_type: q.question_type, options: q.options, marks: Number(q.marks) || 1,
        time_seconds: Number(q.time_seconds) || 60,
      })),
    });
  } catch (error) {
    console.error("competition-official-question-content error:", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load competition questions." }, 400);
  }
});
