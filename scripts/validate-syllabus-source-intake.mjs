import fs from "node:fs";
import path from "node:path";
const p=path.join(process.cwd(),"config/syllabus-source-intake.json");
const r=JSON.parse(fs.readFileSync(p,"utf8"));
const e=[];
for(const x of r.records??[]){
 if(x.artifactStatus==="not_captured" && x.sha256!==null)e.push(x.intakeId+" must have null SHA-256 before capture");
 if(x.artifactStatus!=="approved" && x.contentAuthoringAllowed)e.push(x.intakeId+" cannot unlock authoring before approval");
 if(x.artifactStatus==="approved" && !/^[a-fA-F0-9]{64}$/.test(x.sha256??""))e.push(x.intakeId+" approved artifact requires real SHA-256");
}
if(e.length){console.error("SYLLABUS SOURCE INTAKE INVALID");e.forEach(x=>console.error("- "+x));process.exit(1);}
console.log("SYLLABUS SOURCE INTAKE VALID");
console.log("Discovered sources: "+r.records.length);
console.log("Authoring-unlocked sources: "+r.records.filter(x=>x.contentAuthoringAllowed).length);
