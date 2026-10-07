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
    if (typeof body?.attempt_id !== "string" || !body.attempt_id) throw new Error("attempt_id is required");

    const { data, error } = await supabase.rpc("get_assessment_result", {
      p_attempt_id: body.attempt_id,
      p_student_id: studentId,
    });
    if (error) {
      if (error.message.includes("ASSESSMENT_RESULT_NOT_FOUND")) return json({error:"Assessment result not found"},404);
      if (error.message.includes("ASSESSMENT_RESULT_NOT_AVAILABLE")) return json({error:"Assessment result is not available yet"},409);
      throw new Error("Unable to load assessment result");
    }
    return json({result:data});
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return json({error:message}, message === "Unauthorized" ? 401 : 400);
  }
});
