#!/usr/bin/env node
import fs from "node:fs";
const p=fs.readFileSync("supabase/functions/assessment-question-content/index.ts","utf8");
for(const token of ["const reviewReleased","attempt.status === "submitted"","answerReleasePolicy !== "never"","is_correct: a.is_correct === true","typeof a.explanation === "string"","marks_awarded: Number.isFinite"]) if(!p.includes(token)) throw new Error("missing payload minimization control: "+token);
for(const forbidden of ["release_public_sha256:","release_private_sha256:","integrity_sha256:","option_orders:"]) if(p.includes(forbidden)) throw new Error("internal field leaked in response mapping: "+forbidden);
console.log("ASSESSMENT REVIEW PAYLOAD MINIMIZATION: VALID");
