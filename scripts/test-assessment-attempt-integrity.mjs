#!/usr/bin/env node
import fs from "node:fs";
const files=[
 "supabase/functions/assessment-attempt/index.ts",
 "supabase/functions/assessment-question-content/index.ts",
 "supabase/functions/assessment-answer/index.ts",
 "supabase/functions/assessment-submit/index.ts"
];
for(const f of files){
 const s=fs.readFileSync(f,"utf8");
 if(!s.includes("integrity_sha256")) throw new Error(f+": missing integrity commitment");
 if(!s.includes("Assessment attempt integrity check failed")) throw new Error(f+": missing integrity verification");
}
const start=fs.readFileSync(files[0],"utf8");
if(!start.includes("integrity_sha256: await attemptIntegrityHash")) throw new Error("attempt creation does not persist integrity commitment");
const migration=fs.readFileSync("supabase/migrations/20261010040512_assessment_attempt_integrity.sql","utf8");
if(!migration.includes("add column if not exists integrity_sha256")) throw new Error("integrity migration missing column");
console.log("ASSESSMENT ATTEMPT INTEGRITY: VALID");
