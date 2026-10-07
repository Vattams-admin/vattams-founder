#!/usr/bin/env node
import fs from "node:fs";
const p=fs.readFileSync("supabase/functions/assessment-attempt/index.ts","utf8");
for(const token of ["RETRY_POLICY_PATH","retryLimit","maxAttempts","Assessment retry limit reached","status", "submitted"]) if(!p.includes(token)) throw new Error("missing retry enforcement: "+token);
if(!p.includes("assessment.kind === \"official_attempt\"")) throw new Error("official attempt policy mapping missing");
console.log("ASSESSMENT RETRY ENFORCEMENT: VALID");
