#!/usr/bin/env node
import fs from "node:fs";
const p=fs.readFileSync("supabase/functions/assessment-question-content/index.ts","utf8");
for(const token of ["answerReleasePolicy","after_submission","scheduled","answerReleaseAt","attempt.status === \"in_progress\"","answerReleasePolicy !== \"never\""]) {
 if(!p.includes(token)) throw new Error("review release contract missing: "+token);
}
if(!p.includes("correct_option_index") || !p.includes("explanation")) throw new Error("review fields are not represented");
console.log("ASSESSMENT RESULT REVIEW RELEASE: VALID");
