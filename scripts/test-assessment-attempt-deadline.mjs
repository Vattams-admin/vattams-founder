#!/usr/bin/env node
import fs from "node:fs";

const files=[
 "supabase/functions/assessment-attempt/index.ts",
 "supabase/functions/assessment-question-content/index.ts",
 "supabase/functions/assessment-answer/index.ts",
 "supabase/functions/assessment-submit/index.ts"
];

const start=fs.readFileSync(files[0],"utf8");
if(!start.includes("expires_at")) throw new Error("attempt creation missing expires_at");
if(!start.includes("assessment.time_seconds * 1000")) throw new Error("deadline is not derived from server assessment duration");
if(!start.includes("started_at: startedAt, expires_at: expiresAt")) throw new Error("deadline is not persisted with attempt");

for(const file of files.slice(1)){
 const s=fs.readFileSync(file,"utf8");
 if(!s.includes("expires_at")) throw new Error(file+": deadline field not loaded");
 if(!s.includes("Assessment attempt time has expired")) throw new Error(file+": deadline enforcement missing");
}

const migration=fs.readFileSync("supabase/migrations/20261010040518_assessment_attempt_deadline.sql","utf8");
if(!migration.includes("add column if not exists expires_at")) throw new Error("deadline migration missing column");

console.log("ASSESSMENT ATTEMPT DEADLINE: VALID");
