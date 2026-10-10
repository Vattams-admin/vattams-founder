#!/usr/bin/env node
import fs from "node:fs";
const submit=fs.readFileSync("supabase/functions/assessment-submit/index.ts","utf8");
for(const token of ["correct_option_index","marks_awarded","is_correct","private assessment answer key","finalize_assessment_attempt_result"]) {
 if(!submit.includes(token)) throw new Error("server scoring contract missing: "+token);
}
if(submit.includes('body?.score') || submit.includes('body?.max_score') || submit.includes('body?.is_correct')) throw new Error("client scoring fields are trusted");
if(submit.includes('.from("assessment_results").insert')) throw new Error("direct result insert remains");
const migration=fs.readFileSync("supabase/migrations/20261010040551_assessment_authoritative_scoring.sql","utf8");
for(const token of ["for update","status <> 'in_progress'","ASSESSMENT_SCORE_INVALID","ASSESSMENT_ANSWER_COUNT_INVALID","revoke all on function","grant execute on function"]) {
 if(!migration.includes(token)) throw new Error("authoritative scoring migration missing: "+token);
}
console.log("SERVER AUTHORITATIVE SCORING: VALID");
