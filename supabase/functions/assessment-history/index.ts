import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const supabase = createClient(SUPABASE_URL, KEYS["default"] || "", { auth: { persistSession: false, autoRefreshToken: false } });
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

async function verify(auth: string | null) {
  if (!auth?.startsWith("Bearer ") || !PROJECT_ID) throw new Error("Unauthorized");
  const { payload } = await jwtVerify(auth.slice(7).trim(), jwks, {
    issuer: "https://securetoken.google.com/" + PROJECT_ID, audience: PROJECT_ID,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Invalid Firebase token");
  return payload.sub;
}
function cors(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};}
function json(body: unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(),"Content-Type":"application/json"}});}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors()});
  try {
    const studentId = await verify(req.headers.get("authorization"));
    const body = await req.json().catch(() => ({}));
    const limit = Number.isInteger(body?.limit) ? body.limit : 20;
    const offset = Number.isInteger(body?.offset) ? body.offset : 0;
    if (limit < 1 || limit > 50 || offset < 0) return json({error:"Invalid history pagination"},400);
    const { data, error } = await supabase.rpc("get_assessment_history", {
      p_student_id: studentId, p_limit: limit, p_offset: offset,
    });
    if (error) throw new Error("Unable to load assessment history");
    return json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return json({error:message}, message === "Unauthorized" ? 401 : 400);
  }
});
