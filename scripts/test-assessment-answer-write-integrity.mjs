#!/usr/bin/env node
import fs from "node:fs";
const answer=fs.readFileSync("supabase/functions/assessment-answer/index.ts","utf8");
if(!answer.includes('supabase.rpc("save_assessment_attempt_answer"')) throw new Error("answer path is not atomic");
if(answer.includes('.from("assessment_answers")') && answer.includes(".upsert(")) throw new Error("direct answer upsert remains in runtime");
for(const token of ["questionId","selectedOptionIndex","attempt.option_orders"]) if(!answer.includes(token)) throw new Error("missing answer validation: "+token);
const migration=fs.readFileSync("supabase/migrations/20261010040546_assessment_answer_atomic_write.sql","utf8");
for(const token of ["v_attempt.status <> 'in_progress'","ASSESSMENT_ATTEMPT_EXPIRED","ASSESSMENT_QUESTION_NOT_IN_ATTEMPT","for update","revoke all on function","grant execute on function"]) {
 if(!migration.includes(token)) throw new Error("atomic answer migration missing: "+token);
}
console.log("ASSESSMENT ANSWER WRITE INTEGRITY: VALID");
