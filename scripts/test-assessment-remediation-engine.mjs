#!/usr/bin/env node
import fs from "node:fs";
const policy=JSON.parse(fs.readFileSync("config/assessment-remediation-policy.json","utf8"));
if(policy.weakTopic.minimumAnsweredQuestions!==3) throw new Error("Unexpected minimum evidence threshold");
if(policy.weakTopic.accuracyBelowPercent!==60) throw new Error("Unexpected weak-topic threshold");
if(policy.weakTopic.maximumRecommendations!==10) throw new Error("Unexpected recommendation cap");
if(JSON.stringify(policy.remediationSequence)!==JSON.stringify(["weak_topic_revision","topic_practice","topic_reassessment"])) throw new Error("Invalid remediation sequence");
const src=fs.readFileSync("supabase/functions/assessment-topic-performance/index.ts","utf8");
for(const x of ["get_assessment_topic_performance","p_student_id:studentId","attempted_questions)>=p.min","accuracy_percent)<p.threshold","remediation_sequence:p.sequence"]) if(!src.includes(x)) throw new Error("Missing server remediation control: "+x);
for(const x of ["correct_option_index","explanation","release_public_sha256","release_private_sha256","integrity_sha256","option_orders"]) if(src.includes(x)) throw new Error("Private field leakage detected: "+x);
const wf=fs.readFileSync(".github/workflows/publish-assessment-registry.yml","utf8");
if(!wf.includes("assessment-remediation-policy.json")) throw new Error("Remediation policy is not published to runtime storage");
console.log("ASSESSMENT REMEDIATION ENGINE: VALID");
