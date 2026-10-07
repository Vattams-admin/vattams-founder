import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const readiness=JSON.parse(fs.readFileSync(path.join(root,"config/curriculum-authoring-readiness.json"),"utf8"));
const evidence=JSON.parse(fs.readFileSync(path.join(root,"config/syllabus-artifact-registry.json"),"utf8"));
const map=JSON.parse(fs.readFileSync(path.join(root,"content/school/cbse/class-1/curriculum-map.json"),"utf8"));
const errors=[]; const fail=m=>errors.push(m);
if(readiness.trackId!=="school-cbse-class-1") fail("wrong readiness track");
if(map.trackId!==readiness.trackId) fail("track mismatch");
const approved=evidence.artifacts.filter(a=>a.trackId===readiness.trackId&&a.status==="approved"&&/^[a-fA-F0-9]{64}$/.test(a.sha256??""));
const linked=approved.length>0&&approved.every(a=>(map.evidenceIds??[]).includes(a.artifactId));
const n={subjects:0,chapters:0,topics:0,subtopics:0};
for(const s of map.subjects??[]){n.subjects++;for(const c of s.chapters??[]){n.chapters++;for(const t of c.topics??[]){n.topics++;n.subtopics+=(t.subtopics??[]).length;}}}
const complete=Object.values(n).every(v=>v>0);
if(!linked||!complete){if(readiness.authoringStatus!=="locked")fail("readiness must remain locked");for(const v of Object.values(readiness.controls))if(v!==false)fail("locked readiness cannot enable authoring controls");}
if(errors.length){console.error("CURRICULUM AUTHORING READINESS: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("CURRICULUM AUTHORING READINESS: VALID");
console.log("Track: "+readiness.trackId);
console.log("Approved evidence: "+approved.length);
console.log("Curriculum nodes: "+JSON.stringify(n));
console.log("State: "+((linked&&complete)?"READY":"LOCKED"));
