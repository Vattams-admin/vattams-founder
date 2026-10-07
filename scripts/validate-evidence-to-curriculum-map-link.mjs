import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const evidencePath=path.join(root,"config/syllabus-artifact-registry.json");
const mapPath=path.join(root,"content/school/cbse/class-1/curriculum-map.json");
const evidence=JSON.parse(fs.readFileSync(evidencePath,"utf8"));
const map=JSON.parse(fs.readFileSync(mapPath,"utf8"));

const track="school-cbse-class-1";
const approved=evidence.artifacts.filter(a =>
  a.trackId===track &&
  a.status==="approved" &&
  /^[a-fA-F0-9]{64}$/.test(a.sha256??"")
);

if(approved.length===0){
  console.log("CBSE CLASS 1 EVIDENCE LINK: BLOCKED");
  console.log("No approved artifact with a real SHA-256 exists.");
  console.log("Curriculum map remains locked.");
  process.exit(0);
}

const ids=approved.map(a=>a.artifactId);
const missing=ids.filter(id=>!(map.evidenceIds??[]).includes(id));
if(missing.length){
  console.error("CBSE CLASS 1 EVIDENCE LINK: INVALID");
  console.error("Approved evidence exists but curriculum map is not linked: "+missing.join(", "));
  process.exit(1);
}

if(map.trackId!==track){
  console.error("CBSE CLASS 1 EVIDENCE LINK: INVALID TRACK");
  process.exit(1);
}

console.log("CBSE CLASS 1 EVIDENCE LINK: VALID");
console.log("Approved artifacts linked: "+ids.length);
console.log("Curriculum map may advance to evidence-linked state.");
