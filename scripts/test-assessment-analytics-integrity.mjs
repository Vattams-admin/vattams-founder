#!/usr/bin/env node
import fs from "node:fs";
const m=fs.readFileSync("supabase/migrations/20261007210000_assessment_analytics_integrity.sql","utf8");
const e=fs.readFileSync("supabase/functions/assessment-analytics/index.ts","utf8");
for(const token of ["status = 'submitted'","assessment_results","p_student_id","security definer","grant execute on function public.get_assessment_analytics(text) to service_role"]) if(!m.includes(token)&&!e.includes(token)) throw new Error("missing analytics integrity control: "+token);
for(const forbidden of ["correct_option_index","explanation","release_public_sha256","integrity_sha256","option_orders"]) if(m.includes(forbidden)||e.includes(forbidden)) throw new Error("private metadata exposed by analytics: "+forbidden);
if(e.includes("score:")||e.includes("max_score:")) throw new Error("client-provided score fields detected in analytics endpoint");
console.log("ASSESSMENT ANALYTICS INTEGRITY: VALID");
