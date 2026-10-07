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
  if(bp.status==="ready" && Math.abs(sum(bp.difficulty_distribution)-1)>0.000001) fail(id+": ready blueprint difficulty distribution must sum to 1");
if(!["blocked","ready"].includes(bp.status)) fail(id+": status must be blocked or ready");
  if(!Array.isArray(bp.sections)||!bp.sections.length) fail(id+": sections required");
  else if(bp.sections.reduce((n,s)=>n+Number(s.question_count||0),0)!==bp.question_count) fail(id+": section counts must equal question_count");
  if(!bp.source || !fs.existsSync(path.resolve(root,bp.source))) fail(id+": source blueprint missing");
if(bp.status==="blocked" && !bp.blocked_reason) fail(id+": blocked blueprint requires blocked_reason");
  if(!["after_submission","immediate_practice","scheduled","never"].includes(bp.answer_release_policy)) fail(id+": invalid answer release policy");
  for(const band of bp.eligibility?.age_bands||[]) if(typeof band!=="string"||!band.trim()) fail(id+": invalid age band");
}
for(const [aid,a] of Object.entries(assessments.assessments||{})){
  if(!["published","reviewed"].includes(a.status)) continue;
  if(!a.blueprint_id) fail(aid+": reviewed/published assessment requires blueprint_id");
  const bp=registry.blueprints?.[a.blueprint_id];
  if(!bp) fail(aid+": blueprint_id does not resolve");
  else if(bp.status!=="ready") fail(aid+": reviewed/published assessment blueprint is not ready");
}
if(errors.length){console.error("ASSESSMENT BLUEPRINT REGISTRY: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT BLUEPRINT REGISTRY: VALID");
