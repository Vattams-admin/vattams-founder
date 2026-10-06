import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const supabase = createClient(URL, KEYS["default"] || "", { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

async function verify(auth: string | null) {
  if (!auth?.startsWith("Bearer ") || !PROJECT_ID) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(auth.slice(7).trim(), jwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`, audience: PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}

async function catalog(studentId: string, courseId: string) {
  const { data: access, error: accessError } = await supabase.from("assessment_access_cache")
    .select("assessment_id,enrolment_active,is_admin,checked_at")
    .eq("student_id", studentId).eq("course_id", courseId);
  if (accessError) throw new Error(`Assessment access lookup failed: ${accessError.message}`);

  const allowed = new Map((access || []).filter((row: any) => {
    const checked = new Date(row.checked_at).getTime();
    return (row.is_admin || row.enrolment_active) && Number.isFinite(checked) && Date.now() - checked <= 60 * 60 * 1000;
  }).map((row: any) => [row.assessment_id, true]));

  if (!allowed.size) return { assessments: [] };

  const { data: registryFile, error: registryError } = await supabase.storage.from("academia-course-materials").download("assessments/registry.json");
  if (registryError || !registryFile) throw new Error("Unable to load assessment registry");
  const registry = JSON.parse(await registryFile.text());

  const assessments = Object.values(registry.assessments || {})
    .filter((a: any) =>
      a?.status === "enabled" &&
      a?.course_id === courseId &&
      typeof a.assessment_id === "string" &&
      allowed.has(a.assessment_id) &&
      Number.isInteger(a.question_count) && a.question_count > 0 &&
      Number.isInteger(a.time_seconds) && a.time_seconds > 0
    )
    .map((a: any) => ({
      assessment_id: a.assessment_id,
      slug: a.slug || a.assessment_id,
      title: a.title || a.assessment_id,
      domain: a.domain,
      kind: a.kind,
      question_count: a.question_count,
      time_seconds: a.time_seconds,
      pass_percent: a.pass_percent ?? null,
    }));

  return { assessments };
}

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(), "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers() });
  try {
    const studentId = await verify(request.headers.get("Authorization"));
    const body = await request.json();
    const courseId = typeof body?.course_id === "string" ? body.course_id.trim() : "";
    if (!courseId) return json({ error: "course_id is required" }, 400);
    return json(await catalog(studentId, courseId));
  } catch (error) {
    console.error("assessment-catalog error", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load assessments" }, 400);
  }
});
