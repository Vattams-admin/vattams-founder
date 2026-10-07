import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root=process.cwd(); const input=process.argv[2]; const out=process.argv[3]||"dist/assessment-banks";
if(!input)throw new Error("Usage: node scripts/package-production-question-bank.mjs <ingestion.json> [outputDir]");
const p=path.resolve(root,input); if(!fs.existsSync(p))throw new Error("Missing ingestion package: "+input);
const x=JSON.parse(fs.readFileSync(p,"utf8"));
if(x.governance?.status!=="approved")throw new Error("Packaging requires governance.status=approved");
if(x.governance?.answerKeyPrivate!==true)throw new Error("answerKeyPrivate must be true");
const keys=new Map((x.answerKeys||[]).map(k=>[k.questionId,k])); const ids=new Set();
const pub=[]; const priv=[];
for(const q of x.questions||[]){
 if(ids.has(q.questionId))throw new Error("Duplicate questionId: "+q.questionId); ids.add(q.questionId);
 const k=keys.get(q.questionId); if(!k)throw new Error("Missing private answer key: "+q.questionId);
 const publicQuestion={question_id:q.questionId,assessment_id:x.assessmentId,question:q.question,options:q.options,section_id:q.sectionId,subject:q.subject,topic:q.topic,subtopic:q.subtopic,language:q.language,difficulty:q.difficulty,age_band:q.ageBand,exam_id:q.examId,marks:q.marks,time_seconds:q.timeSeconds,review_status:q.reviewStatus};
 if(Object.hasOwn(publicQuestion,"correct_option_index"))throw new Error("Public answer leakage: "+q.questionId);
 pub.push(publicQuestion);
 priv.push({question_id:q.questionId,correct_option_index:k.correctOptionIndex,explanation:k.explanation,review_status:k.reviewStatus});
}
if(priv.length!==pub.length)throw new Error("Public/private count mismatch");
const canonical=v=>JSON.stringify(v); const hash=v=>crypto.createHash("sha256").update(canonical(v)).digest("hex");
const publicHash=hash(pub), privateHash=hash(priv); const dir=path.resolve(root,out); fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,x.assessmentId+".public.json"),JSON.stringify(pub,null,2)+"\n");
fs.writeFileSync(path.join(dir,x.assessmentId+".private.json"),JSON.stringify(priv,null,2)+"\n");
const repoRelative=p=>path.relative(root,p).split(path.sep).join("/");
const manifest={version:"1.0.0",assessmentId:x.assessmentId,questionCount:pub.length,publicBank:repoRelative(path.join(dir,x.assessmentId+".public.json")),privateAnswerKey:repoRelative(path.join(dir,x.assessmentId+".private.json")),publicSha256:publicHash,privateSha256:privateHash,sourceEvidence:x.governance.sourceEvidence,packagedAt:new Date().toISOString(),answerKeyPrivate:true};
fs.writeFileSync(path.join(dir,x.assessmentId+".manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("PRODUCTION QUESTION BANK: PACKAGED"); console.log("Questions: "+pub.length); console.log("Public SHA-256: "+publicHash); console.log("Private SHA-256: "+privateHash);