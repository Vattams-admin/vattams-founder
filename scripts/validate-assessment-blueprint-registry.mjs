import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const assessments=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const errors=[];
const fail=m=>errors.push(m);
if(registry.version!==1 || !registry.blueprints) fail("blueprint registry must use version 1");
const sum=o=>Object.values(o||{}).reduce((a,b)=>a+Number(b),0);

for(const [id,bp] of Object.entries(registry.blueprints||{})){
  if(!Number.isInteger(bp.question_count)||bp.question_count<1) fail(id+": question_count invalid");
  if(!Number.isInteger(bp.time_seconds)||bp.time_seconds<1) fail(id+": time_seconds invalid");
  if(Math.abs(sum(bp.difficulty_distribution)-1)>0.000001) fail(id+": difficulty distribution must sum to 1");
  if(!Array.isArray(bp.sections)||!bp.sections.length) fail(id+": sections required");
  else if(bp.sections.reduce((n,s)=>n+Number(s.question_count||0),0)!==bp.question_count) fail(id+": section counts must equal question_count");
  if(!bp.source || !fs.existsSync(path.resolve(root,bp.source))) fail(id+": source blueprint missing");
  if(!["after_submission","immediate_practice","scheduled","never"].includes(bp.answer_release_policy)) fail(id+": invalid answer release policy");
  for(const band of bp.eligibility?.age_bands||[]) if(typeof band!=="string"||!band.trim()) fail(id+": invalid age band");
}
for(const [aid,a] of Object.entries(assessments.assessments||{})){
  if(!["published","reviewed"].includes(a.status)) continue;
  const matching=Object.entries(registry.blueprints||{}).find(([,bp])=>a.question_count===bp.question_count && a.time_seconds===bp.time_seconds);
  if(!matching) fail(aid+": reviewed/published assessment has no executable blueprint");
}
if(errors.length){console.error("ASSESSMENT BLUEPRINT REGISTRY: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT BLUEPRINT REGISTRY: VALID");
