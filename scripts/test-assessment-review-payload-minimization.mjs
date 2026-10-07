#!/usr/bin/env node
import fs from "node:fs";
const p=fs.readFileSync("supabase/functions/assessment-question-content/index.ts","utf8");
for (const token of [
  "const reviewReleased",
  "attempt.status === \"submitted\"",
  "answerReleasePolicy !== \"never\"",
  "item.is_correct",
  "item.correct_option_index",
  "item.explanation",
  "item.marks_awarded",
]) if (!p.includes(token)) throw new Error("missing payload minimization control: "+token);
const response = p.slice(p.indexOf("  return {"));
for (const forbidden of ["release_version:", "release_public_sha256:", "release_private_sha256:", "integrity_sha256:", "option_orders:", "answer: a.answer"]) {
  if (response.includes(forbidden)) throw new Error("internal field leaked in response mapping: "+forbidden);
}
console.log("ASSESSMENT REVIEW PAYLOAD MINIMIZATION: VALID");
