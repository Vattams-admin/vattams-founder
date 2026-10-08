import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const readinessPath=path.join(root,"config/curriculum-authoring-readiness.json");
const readiness=fs.existsSync(readinessPath)
  ? JSON.parse(fs.readFileSync(readinessPath,"utf8"))
  : null;

const cliPath=process.argv[2];
const packagePaths=cliPath
  ? [path.resolve(root,cliPath)]
  : [];

if(!cliPath){
  const walk=(dir)=>{
    if(!fs.existsSync(dir)) return;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()) walk(full);
      else if(entry.isFile() && entry.name==="authoring-package.json") packagePaths.push(full);
    }
  };
  walk(path.join(root,"content"));
}

if(packagePaths.length===0){
  console.log("CONTENT AUTHORING PACKAGE: NO PACKAGES FOUND");
  process.exit(0);
}

let totalErrors=0;
let totalQuestions=0;
for(const pkgPath of packagePaths){
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
const errors=[]; const fail=m=>errors.push(m);
const isCourse=pkg.locator?.domain==="course";
const isSchool=pkg.locator?.domain==="school";

if(isSchool && readiness && readiness.authoringStatus!=="ready" && readiness.authoringStatus!=="authoring" && readiness.authoringStatus!=="in_review" && readiness.authoringStatus!=="approved" && readiness.authoringStatus!=="published")
  fail("school authoring package exists while readiness is not READY");

if(!pkg.packageId || !pkg.version || !pkg.trackId) fail("packageId, version and trackId are required");
if(!pkg.locator?.domain || !pkg.locator?.language) fail("locator.domain and locator.language are required");

for(const [name,fields] of Object.entries({
  studyMaterial:["objectives","concepts","definitions","workedExamples","commonMistakes","keyTakeaways","revisionPoints"],
  practice:["basic","conceptual","application","higherOrderThinking","mixedReview"],
  revision:["quickRevision","flashRecall","formulaOrFactBank","mistakeBasedRevision","weakTopicRevision"]
})){
  if(!pkg[name] || typeof pkg[name]!=="object") fail(name+" is required");
  else for(const field of fields) if(!Array.isArray(pkg[name][field])) fail(name+"."+field+" must be an array");
}

if(isCourse){
  const required=["course","subject","module","lesson","topic"];
  for(const field of required) if(!pkg.locator?.[field]) fail("course locator missing: "+field);
  if(!pkg.outcomes || !Array.isArray(pkg.outcomes) || pkg.outcomes.length===0) fail("course package requires measurable outcomes");
  if(!pkg.activities || !Array.isArray(pkg.activities) || pkg.activities.length===0) fail("course package requires lesson activities");
}

if(!Array.isArray(pkg.questions)) fail("questions must be an array");
if(!Array.isArray(pkg.answerKeys)) fail("answerKeys must be an array");

const qids=new Set();
for(const q of pkg.questions){
  if(!q.questionId) fail("questionId is required");
  if(qids.has(q.questionId)) fail("duplicate question ID: "+q.questionId);
  qids.add(q.questionId);
  if(!Array.isArray(q.options)||q.options.length!==4) fail("question must have exactly 4 options: "+q.questionId);
  if(new Set(q.options).size!==4) fail("question options must be unique: "+q.questionId);
  if(!q.question || !q.difficulty || !(q.timeSeconds>0)) fail("question metadata incomplete: "+q.questionId);
}
const keys=new Map(pkg.answerKeys.map(k=>[k.questionId,k]));
for(const qid of qids) if(!keys.has(qid)) fail("missing private answer key: "+qid);
for(const k of pkg.answerKeys) if(!qids.has(k.questionId)) fail("orphan private answer key: "+k.questionId);
for(const k of pkg.answerKeys) if(!Number.isInteger(k.correctOptionIndex)||k.correctOptionIndex<0||k.correctOptionIndex>3||!k.explanation) fail("invalid private answer key: "+k.questionId);
if(pkg.governance?.answerKeyPrivate!==true) fail("answerKeyPrivate must be true");
if(!pkg.governance?.provenance || !Array.isArray(pkg.governance.provenance) || pkg.governance.provenance.length===0) fail("governance.provenance is required");
if(!pkg.governance?.contentHash) fail("governance.contentHash is required");

if(errors.length){
  console.error("INVALID: "+path.relative(root,pkgPath));
  errors.forEach(e=>console.error("- "+e));
  totalErrors+=errors.length;
}else{
  console.log("VALID: "+path.relative(root,pkgPath)+" | "+pkg.locator.domain+" | "+pkg.questions.length+" questions");
}
totalQuestions+=pkg.questions.length;
}
console.log("Packages checked: "+packagePaths.length);
console.log("Questions checked: "+totalQuestions);
if(totalErrors) process.exit(1);
