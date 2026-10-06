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
  return { uid: payload.sub, token: auth.slice(7).trim() };
}

async function refreshAccess(studentId: string, courseId: string, token: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "enrolments" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "student_id" }, op: "EQUAL", value: { stringValue: studentId } } },
          { fieldFilter: { field: { fieldPath: "course_id" }, op: "EQUAL", value: { stringValue: courseId } } },
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
        ]}},
        limit: 1,
      },
    }),
  });
  if (!response.ok) throw new Error("Unable to verify course enrolment");
  const rows = await response.json();
  const active = Array.isArray(rows) && rows.some((row: any) => row?.document);
  const now = new Date().toISOString();
  const { data: registryFile, error: registryError } = await supabase.storage.from("academia-course-materials").download("assessments/registry.json");
  if (registryError || !registryFile) throw new Error("Unable to load assessment registry");
  const registry = JSON.parse(await registryFile.text());
  const publishedIds = Object.values(registry.assessments || {}).filter((a: any) =>
    a?.status === "published" && a?.course_id === courseId && typeof a.assessment_id === "string"
  ).map((a: any) => a.assessment_id);
  if (publishedIds.length) {
    const writes = publishedIds.map((assessmentId: string) => ({
      student_id: studentId, course_id: courseId, assessment_id: assessmentId,
      enrolment_active: active, is_admin: false, checked_at: now,
    }));
    const { error } = await supabase.from("assessment_access_cache").upsert(writes, { onConflict: "student_id,course_id,assessment_id" });
    if (error) throw new Error(`Assessment access refresh failed: ${error.message}`);
  }
}

async function catalog(studentId: string, courseId: string, token: string) {
  await refreshAccess(studentId, courseId, token);
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
      a?.status === "published" &&
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
    const auth = await verify(request.headers.get("Authorization"));
    const body = await request.json();
    const courseId = typeof body?.course_id === "string" ? body.course_id.trim() : "";
    if (!courseId) return json({ error: "course_id is required" }, 400);
    return json(await catalog(auth.uid, courseId, auth.token));
  } catch (error) {
    console.error("assessment-catalog error", error);
    return json({ error: error instanceof Error ? error.message : "Unable to load assessments" }, 400);
  }
});