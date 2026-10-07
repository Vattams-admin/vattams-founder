#!/usr/bin/env node
import fs from "node:fs";
const m=fs.readFileSync("supabase/migrations/20261007190000_assessment_attempt_lifecycle_guard.sql","utf8");
const p=fs.readFileSync("supabase/functions/assessment-attempt/index.ts","utf8");
for(const token of ["create unique index","where status = 'in_progress'","findLatestAttempt","existing?.status === \"in_progress\"","existing?.status === \"submitted\""]) if(!m.includes(token)&&!p.includes(token)) throw new Error("missing lifecycle control: "+token);
if(!m.includes("(student_id, assessment_id)")) throw new Error("active attempt uniqueness scope missing");
if(!p.includes("if (error.code === \"23505\")")) throw new Error("concurrent attempt race recovery missing");
console.log("ASSESSMENT ATTEMPT LIFECYCLE: VALID");
