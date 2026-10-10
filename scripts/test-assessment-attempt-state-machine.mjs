#!/usr/bin/env node
import fs from "node:fs";
const submit=fs.readFileSync("supabase/functions/assessment-submit/index.ts","utf8");
if(!submit.includes("transition_assessment_attempt_to_submitted") && !submit.includes("finalize_assessment_attempt_result")) throw new Error("submit does not use an atomic terminal state transition");
if(submit.includes('.update({ status: "submitted"')) throw new Error("submit still performs client-side conditional state update");
const migration=fs.readFileSync("supabase/migrations/20261010040539_assessment_attempt_state_machine.sql","utf8");
for(const token of ["status = 'submitted'","status = 'in_progress'","p_submitted_at < expires_at","revoke all on function","grant execute on function"]) {
 if(!migration.includes(token)) throw new Error("state transition migration missing: "+token);
}
console.log("ASSESSMENT ATTEMPT STATE MACHINE: VALID");
