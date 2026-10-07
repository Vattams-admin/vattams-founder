#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const history=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-version-history.json"),"utf8"));
const errors=[];
const sha=rel=>{
 const p=path.resolve(root,rel); if(!fs.existsSync(p)) return null;
 const v=JSON.parse(fs.readFileSync(p,"utf8"));
 return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
};
const cmp=(a,b)=>a.split(".").map(Number).map((n,i)=>n-(b.split(".").map(Number)[i])).find(n=>n!==0)||0;
for(const [id,a] of Object.entries(registry.assessments||{})){
 if(a.status==="draft") continue;
 const h=history.assessments?.[id];
 if(!h){errors.push(id+": published/reviewed assessment requires version history");continue}
 if(h.assessmentId!==id)errors.push(id+": assessmentId mismatch");
 if(h.currentVersion!==h.versions.at(-1)?.version)errors.push(id+": currentVersion must equal latest history version");
 const seen=new Set();
 h.versions.forEach((v,i)=>{
  if(seen.has(v.version))errors.push(id+": duplicate version "+v.version); seen.add(v.version);
  if(i>0 && cmp(h.versions[i-1].version,v.version)>=0)errors.push(id+": versions must increase monotonically");
  if(!v.publicSha256||!v.privateSha256)errors.push(id+": version "+v.version+" missing integrity hashes");
  if(i>0 && v.supersedesVersion!==h.versions[i-1].version)errors.push(id+": version "+v.version+" must supersede previous version");
  if(i===0 && v.supersedesVersion)errors.push(id+": first version cannot supersede another version");
 });
 const latest=h.versions.at(-1);
 const ph=sha(a.question_bank_public),kh=sha(a.answer_key);
 if(latest && ph && latest.publicSha256!==ph)errors.push(id+": current public bank differs from version history");
 if(latest && kh && latest.privateSha256!==kh)errors.push(id+": current private key differs from version history");
}
if(errors.length){console.error("ASSESSMENT VERSION HISTORY: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT VERSION HISTORY: VALID");
console.log("Non-draft assessments checked: "+Object.values(registry.assessments||{}).filter(a=>a.status!=="draft").length);
