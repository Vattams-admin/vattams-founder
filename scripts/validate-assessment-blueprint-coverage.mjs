import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const bpRegistry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const assessmentRegistry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const errors=[]; const fail=m=>errors.push(m);
function readJson(p,label){const f=path.resolve(root,p);if(!fs.existsSync(f)) throw new Error(label+": missing "+p);return JSON.parse(fs.readFileSync(f,"utf8"))}
for(const [id,bp] of Object.entries(bpRegistry.blueprints||{})){
  const coveragePath="config/assessment-blueprint-coverage/"+id+".json";
  if(!fs.existsSync(path.resolve(root,coveragePath))){if(bp.status==="ready") fail(id+": ready blueprint has no coverage report");continue}
  const c=readJson(coveragePath,id+" coverage");
  if(c.blueprint_id!==id) fail(id+": coverage blueprint_id mismatch");
  const assessments=Object.entries(assessmentRegistry.assessments||{}).filter(([,a])=>a.blueprint_id===id);
  if(!assessments.length) fail(id+": no assessments reference blueprint");
  if(bp.status==="ready" && c.inventory?.eligible_questions < bp.question_count) fail(id+": insufficient eligible inventory");
  if(c.status==="ready" && bp.status!=="ready") fail(id+": coverage cannot be ready while blueprint is blocked");
  if(c.status==="ready" && (c.blocked_reasons||[]).length) fail(id+": ready coverage cannot contain blocked reasons");
  if(c.status==="ready"){
    if(!c.coverage?.sections || !c.coverage?.difficulty) fail(id+": ready coverage missing section/difficulty evidence");
    if(!c.coverage.eligibility?.all_required) fail(id+": eligibility coverage is incomplete");
    const d=c.coverage.difficulty;
    if(!d || !["easy","medium","hard"].every(k=>Number(d[k]?.available)>=Number(d[k]?.required))) fail(id+": difficulty inventory does not satisfy required quotas");
  }
}
if(errors.length){console.error("ASSESSMENT BLUEPRINT COVERAGE: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT BLUEPRINT COVERAGE: VALID");
