#!/usr/bin/env node
import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/20261010040557_assessment_result_access_isolation.sql","utf8");
const endpoint=fs.readFileSync("supabase/functions/assessment-result/index.ts","utf8");
const engine=fs.readFileSync("supabase/migrations/20261006180000_generic_assessment_engine.sql","utf8");
for(const token of ["security definer","ASSESSMENT_RESULT_NOT_FOUND","p_student_id","grant execute on function public.get_assessment_result(uuid,text) to service_role"]) if(!migration.includes(token)) throw new Error("missing isolation control: "+token);
for(const token of ["verify(req.headers.get(\"authorization\"))","p_student_id: studentId","get_assessment_result"]) if(!endpoint.includes(token)) throw new Error("missing endpoint ownership control: "+token);
for(const token of ["revoke all on public.assessment_results from anon, authenticated","revoke all on public.assessment_answers from anon, authenticated"]) if(!engine.includes(token)) throw new Error("missing table isolation: "+token);
console.log("ASSESSMENT RESULT ISOLATION: VALID");
