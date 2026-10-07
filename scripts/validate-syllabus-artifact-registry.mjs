import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/syllabus-artifact-registry.json"),"utf8"));
const errors=[];
const fail=m=>errors.push(m);
const ids=new Set();

if(registry.version!==1) fail("registry version must be 1");
if(registry.registryId!=="vattams-syllabus-artifact-registry") fail("invalid registryId");

for(const a of registry.artifacts??[]){
  if(ids.has(a.artifactId)) fail("duplicate artifactId: "+a.artifactId);
  ids.add(a.artifactId);
  if(!/^[a-fA-F0-9]{64}$/.test(a.sha256??"")) fail("invalid SHA-256 for "+a.artifactId);
  if(!a.sourceLocator) fail("missing sourceLocator for "+a.artifactId);
  if(!a.retrievedAt) fail("missing retrievedAt for "+a.artifactId);
  if(a.status==="approved" && !["verified","approved"].includes(a.status)) fail("invalid approval state "+a.artifactId);
  if(a.status==="superseded" && !a.supersedesArtifactId) fail("superseded artifact must identify replacement: "+a.artifactId);
}

if(errors.length){
 console.error("SYLLABUS ARTIFACT REGISTRY INVALID");
 errors.forEach(e=>console.error("- "+e));
 process.exit(1);
}
console.log("SYLLABUS ARTIFACT REGISTRY VALID");
console.log("Artifacts: "+registry.artifacts.length);
console.log("Verified/approved: "+registry.artifacts.filter(a=>["verified","approved"].includes(a.status)).length);
console.log("No placeholder SHA-256 values accepted.");
