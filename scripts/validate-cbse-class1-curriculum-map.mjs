import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const map=JSON.parse(fs.readFileSync(path.join(root,"content/school/cbse/class-1/curriculum-map.json"),"utf8"));
const errors=[];
const fail=m=>errors.push(m);

if(map.trackId!=="school-cbse-class-1") fail("wrong track");
if(!Array.isArray(map.evidenceIds) || map.evidenceIds.length===0) fail("curriculum map is blocked until approved evidenceIds exist");
if(map.status!=="draft" && map.evidenceIds.length===0) fail("non-draft map cannot exist without evidence");
if(!Array.isArray(map.subjects)) fail("subjects must be an array");

if(errors.length){
 console.error("CBSE CLASS 1 CURRICULUM MAP BLOCKED");
 errors.forEach(e=>console.error("- "+e));
 process.exit(1);
}
console.log("CBSE CLASS 1 CURRICULUM MAP VALID");
console.log("Approved evidence IDs: "+map.evidenceIds.length);
console.log("Subjects: "+map.subjects.length);
