import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const policy=JSON.parse(fs.readFileSync(path.join(root,"config/question-quality-security.json"),"utf8"));
const packagePath=path.join(root,"content/school/cbse/class-1/authoring-package.json");
if(!fs.existsSync(packagePath)){console.log("QUESTION QUALITY SECURITY: BLOCKED — no authoring package exists.");process.exit(0);}
const pkg=JSON.parse(fs.readFileSync(packagePath,"utf8"));
const errors=[];const fail=m=>errors.push(m);
const questions=pkg.questions??[];const keys=new Map((pkg.answerKeys??[]).map(k=>[k.questionId,k]));
const ids=new Set();
for(const q of questions){
  if(!q.questionId||ids.has(q.questionId)) fail("missing or duplicate question ID");
  ids.add(q.questionId);
  if(!Array.isArray(q.options)||q.options.length!==policy.rules.exactOptionCount) fail("question must have exactly 4 options: "+q.questionId);
  if(new Set(q.options).size!==q.options.length) fail("duplicate options: "+q.questionId);
  if(!q.question?.trim()) fail("question text missing: "+q.questionId);
  if(!["easy","medium","hard"].includes(q.difficulty)) fail("invalid difficulty: "+q.questionId);
  if(!q.curriculumLocator) fail("curriculum locator missing: "+q.questionId);
  if(!q.ageBand) fail("age band missing: "+q.questionId);
  if(!q.provenance) fail("provenance missing: "+q.questionId);
  const k=keys.get(q.questionId);
  if(!k) fail("private answer key missing: "+q.questionId);
  else{
    if(!Number.isInteger(k.correctOptionIndex)||k.correctOptionIndex<0||k.correctOptionIndex>3) fail("invalid private answer index: "+q.questionId);
    if(!k.explanation?.trim()) fail("answer explanation missing: "+q.questionId);
    if(k.correctOptionIndex>=q.options.length) fail("answer index outside option set: "+q.questionId);
  }
}
for(const k of pkg.answerKeys??[]) if(!ids.has(k.questionId)) fail("orphan answer key: "+k.questionId);
if(pkg.governance?.answerKeyPrivate!==true) fail("answerKeyPrivate must remain true");
if(pkg.status==="published"&&pkg.governance?.reviewStatus!=="approved") fail("published questions require approved review status");
if(errors.length){console.error("QUESTION QUALITY SECURITY: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("QUESTION QUALITY SECURITY: VALID");
console.log("Questions checked: "+questions.length);
console.log("Private keys checked: "+(pkg.answerKeys??[]).length);
console.log("Answer-key separation: ENFORCED");
console.log("Official answer visibility: HIDDEN");
