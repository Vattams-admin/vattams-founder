import fs from "node:fs";
import path from "node:path";
import { CATALOG_ITEMS, CATEGORY } from "./catalog-data.mjs";

const root=path.resolve("content/competition-study-materials");
const data=JSON.parse(fs.readFileSync(path.join(root,"authored-competition-curricula-v1.json"),"utf8"));
const catalog=CATALOG_ITEMS.filter(x=>x.category_id===CATEGORY.VATTAMS_COMPETITIONS).map(x=>x.name);
const failures=[];
const comps=data.competitions??{};
if(data.competition_count!==catalog.length) failures.push("competition_count mismatch");
if(Object.keys(comps).length!==catalog.length) failures.push("authored competition count mismatch");
for(const name of catalog){
 const c=comps[name]; if(!c){failures.push(name+": missing");continue;}
 if(c.status!=="authored_curriculum_v1") failures.push(name+": not authored_curriculum_v1");
 if(!Array.isArray(c.age_bands)||c.age_bands.length<2) failures.push(name+": age bands");
 if(!Array.isArray(c.learning_paths)||c.learning_paths.length<3) failures.push(name+": learning paths");
 if(!Array.isArray(c.domains)||c.domains.length<6) failures.push(name+": domains");
 for(const d of c.domains??[]) {
  if(!d.title||!Array.isArray(d.resources)||d.resources.length<3) failures.push(name+"/"+d.title+": resources");
  if(!d.topic_assessment||!d.revision_map?.length) failures.push(name+"/"+d.title+": assessment/revision");
  for(const r of d.resources??[]){
   for(const k of ["objective","teaching_content","worked_examples","guided_practice","independent_practice","assessment_checkpoint","revision","mastery_check","resources","question_mapping"])
    if(!r[k]||(Array.isArray(r[k])&&r[k].length===0)) failures.push(name+"/"+d.title+"/"+r.subtopic+": missing "+k);
   if((r.worked_examples?.length??0)<2) failures.push(name+"/"+d.title+"/"+r.subtopic+": examples");
   if((r.guided_practice?.length??0)<3) failures.push(name+"/"+d.title+"/"+r.subtopic+": guided");
   if((r.independent_practice?.length??0)<5) failures.push(name+"/"+d.title+"/"+r.subtopic+": independent");
  }
 }
 if(!Array.isArray(c.mock_tests)||c.mock_tests.length<3) failures.push(name+": mock tests");
 if(c.official_attempt?.separate!==true) failures.push(name+": official attempt not separate");
}
for(const n of Object.keys(comps)) if(!catalog.includes(n)) failures.push("UNMATCHED: "+n);
console.log("Catalog: "+catalog.length);
console.log("Authored: "+Object.keys(comps).length);
console.log("Domains: "+Object.values(comps).reduce((n,c)=>n+c.domains.length,0));
console.log("Subtopics: "+Object.values(comps).reduce((n,c)=>n+c.domains.reduce((x,d)=>x+d.resources.length,0),0));
if(failures.length){console.log("RESULT: FAILED");failures.forEach(x=>console.log("- "+x));process.exit(1);}
console.log("RESULT: PASS");
