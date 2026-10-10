#!/usr/bin/env node
import fs from "node:fs";
const m=fs.readFileSync("supabase/migrations/20261010040610_assessment_history_access.sql","utf8");
const e=fs.readFileSync("supabase/functions/assessment-history/index.ts","utf8");
for(const token of ["where student_id = p_student_id","security definer","limit v_limit offset v_offset","grant execute on function public.get_assessment_history(text,integer,integer) to service_role","p_student_id: studentId"]) if(!m.includes(token)&&!e.includes(token)) throw new Error("missing history isolation control: "+token);
for(const forbidden of ["correct_option_index","explanation","release_public_sha256","release_private_sha256","integrity_sha256","option_orders"]) if(m.includes(forbidden)||e.includes(forbidden)) throw new Error("private field exposed by history layer: "+forbidden);
console.log("ASSESSMENT HISTORY ACCESS: VALID");
