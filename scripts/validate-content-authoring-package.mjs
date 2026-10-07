import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const readiness=JSON.parse(fs.readFileSync(path.join(root,"config/curriculum-authoring-readiness.json"),"utf8"));
const pkgPath=path.join(root,"content/school/cbse/class-1/authoring-package.json");
if(!fs.existsSync(pkgPath)){console.log("CONTENT AUTHORING PACKAGE: NOT PRESENT");console.log("State: BLOCKED — authoring package cannot be created until readiness is READY.");process.exit(0);}
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
const errors=[];const fail=m=>errors.push(m);
if(readiness.authoringStatus!=="ready" && readiness.authoringStatus!=="authoring" && readiness.authoringStatus!=="in_review" && readiness.authoringStatus!=="approved" && readiness.authoringStatus!=="published") fail("authoring package exists while readiness is not READY");
if(pkg.trackId!==readiness.trackId) fail("package track mismatch");
if(!Array.isArray(pkg.questions)) fail("questions must be an array");
if(!Array.isArray(pkg.answerKeys)) fail("answerKeys must be an array");
const qids=new Set();
for(const q of pkg.questions){
 if(qids.has(q.questionId)) fail("duplicate question ID: "+q.questionId);
 qids.add(q.questionId);
 if(!Array.isArray(q.options)||q.options.length!==4) fail("question must have exactly 4 options: "+q.questionId);
 if(new Set(q.options).size!==4) fail("question options must be unique: "+q.questionId);
}
const keys=new Map(pkg.answerKeys.map(k=>[k.questionId,k]));
for(const qid of qids) if(!keys.has(qid)) fail("missing private answer key: "+qid);
for(const k of pkg.answerKeys) if(!qids.has(k.questionId)) fail("orphan private answer key: "+k.questionId);
if(pkg.governance?.answerKeyPrivate!==true) fail("answerKeyPrivate must be true");
if(errors.length){console.error("CONTENT AUTHORING PACKAGE: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("CONTENT AUTHORING PACKAGE: VALID");
console.log("Track: "+pkg.trackId);
console.log("Questions: "+pkg.questions.length);
console.log("Private answer keys: "+pkg.answerKeys.length);
