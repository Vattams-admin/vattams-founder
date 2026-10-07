import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";
const PROJECT_ID=Deno.env.get("FIREBASE_PROJECT_ID")||Deno.env.get("VITE_FIREBASE_PROJECT_ID")||"";
const URL=Deno.env.get("SUPABASE_URL")||"";
const KEYS=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
const db=createClient(URL,KEYS["default"]||"",{auth:{persistSession:false,autoRefreshToken:false}});
const jwks=createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
async function uid(auth:string|null){if(!auth?.startsWith("Bearer ")||!PROJECT_ID)throw new Error("Unauthorized");const {payload}=await jwtVerify(auth.slice(7),jwks,{issuer:"https://securetoken.google.com/"+PROJECT_ID,audience:PROJECT_ID});if(typeof payload.sub!=="string")throw new Error("Invalid Firebase token");return payload.sub;}
const headers=()=>({"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"});
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:headers()});try{const studentId=await uid(req.headers.get("authorization"));const body=await req.json().catch(()=>({}));const assessmentId=typeof body?.assessment_id==="string"?body.assessment_id.trim():null;const {data,error}=await db.rpc("get_assessment_topic_performance",{p_student_id:studentId,p_assessment_id:assessmentId});if(error)throw new Error("Unable to load topic performance");return new Response(JSON.stringify({items:data}),{headers:{...headers(),"Content-Type":"application/json"}});}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Request failed"}),{status:400,headers:{...headers(),"Content-Type":"application/json"}});}});
