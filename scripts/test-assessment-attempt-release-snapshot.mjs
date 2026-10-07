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
 if(!s.includes("release_version")||!s.includes("release_public_sha256")||!s.includes("release_private_sha256")) throw new Error(f+": missing release snapshot fields");
}
const start=fs.readFileSync(files[0],"utf8");
if(!start.includes("release_version: assessment.release_version")) throw new Error("attempt start does not persist release snapshot");
for(const f of files.slice(1)){
 const s=fs.readFileSync(f,"utf8");
 if(!s.includes("Assessment release changed after this attempt started")) throw new Error(f+": missing snapshot lock");
}
const migration=fs.readFileSync("supabase/migrations/20261007120000_assessment_attempt_release_snapshot.sql","utf8");
if(!migration.includes("add column if not exists release_version")) throw new Error("migration missing release_version");
console.log("ASSESSMENT ATTEMPT RELEASE SNAPSHOT: VALID");
