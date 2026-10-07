import fs from "node:fs";
import path from "node:path";
const root=process.cwd(); const file=process.argv[2];
if(!file)throw new Error("Usage: node scripts/validate-production-question-ingestion.mjs <package.json>");
const p=path.resolve(root,file); if(!fs.existsSync(p))throw new Error("Missing ingestion package: "+file);
const x=JSON.parse(fs.readFileSync(p,"utf8")); const e=[]; const ids=new Set(); const keyIds=new Set();
if(!x.assessmentId)e.push("assessmentId required");
if(!Array.isArray(x.questions)||!x.questions.length)e.push("questions must be non-empty");
if(!Array.isArray(x.answerKeys))e.push("answerKeys must be an array");
for(const q of x.questions||[]){
 if(!q.questionId||ids.has(q.questionId))e.push("missing or duplicate questionId: "+q.questionId); ids.add(q.questionId);
 if(!Array.isArray(q.options)||q.options.length!==4||new Set(q.options).size!==4)e.push("exactly four unique options required: "+q.questionId);
 for(const f of ["sectionId","subject","topic","subtopic","language","ageBand","examId","provenance"])if(!String(q[f]??"").trim())e.push(f+" required: "+q.questionId);
 if(!["easy","medium","hard"].includes(q.difficulty))e.push("invalid difficulty: "+q.questionId);
 if(q.reviewStatus!=="reviewed")e.push("question must be reviewed: "+q.questionId);
 if(Object.hasOwn(q,"correctOptionIndex")||Object.hasOwn(q,"explanation")||Object.hasOwn(q,"answer"))e.push("private answer data leaked into question: "+q.questionId);
}
for(const k of x.answerKeys||[]){if(!k.questionId||keyIds.has(k.questionId))e.push("missing or duplicate answer key: "+k.questionId);keyIds.add(k.questionId);if(!ids.has(k.questionId))e.push("orphan answer key: "+k.questionId);if(!Number.isInteger(k.correctOptionIndex)||k.correctOptionIndex<0||k.correctOptionIndex>3)e.push("invalid answer index: "+k.questionId);if(String(k.explanation||"").trim().length<12)e.push("explanation required: "+k.questionId);if(k.reviewStatus!=="reviewed")e.push("answer key must be reviewed: "+k.questionId);}
for(const id of ids)if(!keyIds.has(id))e.push("missing private answer key: "+id);
if(x.governance?.answerKeyPrivate!==true)e.push("answerKeyPrivate must be true");
if(!Array.isArray(x.governance?.sourceEvidence)||!x.governance.sourceEvidence.length)e.push("sourceEvidence required");
if(e.length){console.error("PRODUCTION QUESTION INGESTION: INVALID");e.forEach(v=>console.error("- "+v));process.exit(1)}
console.log("PRODUCTION QUESTION INGESTION: VALID"); console.log("Questions: "+ids.size); console.log("Private keys: "+keyIds.size); console.log("Answer-key separation: ENFORCED");