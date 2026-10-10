#!/usr/bin/env node
import fs from "node:fs";
const m=fs.readFileSync("supabase/migrations/20261010040624_assessment_topic_performance.sql","utf8");
const s=fs.readFileSync("supabase/functions/assessment-submit/index.ts","utf8");
const e=fs.readFileSync("supabase/functions/assessment-topic-performance/index.ts","utf8");
for(const x of ["status = 'submitted'","aa.is_correct = true","aa.subject","aa.topic","p_student_id","security definer"]) if(!m.includes(x)&&!e.includes(x)) throw new Error("missing weak-topic control: "+x);
for(const x of ["persist_assessment_scored_answers","subject: typeof publicQuestion.subject","topic: typeof publicQuestion.topic"]) if(!s.includes(x)) throw new Error("scoring metadata persistence missing: "+x);
for(const x of ["correct_option_index","explanation","release_public_sha256","integrity_sha256","option_orders"]) if(e.includes(x)) throw new Error("private metadata leaked by topic endpoint: "+x);
console.log("ASSESSMENT WEAK-TOPIC ANALYTICS: VALID");
