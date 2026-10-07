import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/syllabus-artifact-registry.json"),"utf8"));
const map=JSON.parse(fs.readFileSync(path.join(root,"content/school/cbse/class-1/curriculum-map.json"),"utf8"));
const errors=[]; const fail=m=>errors.push(m);
const track="school-cbse-class-1";

const approved=new Map(
  registry.artifacts
    .filter(a=>a.trackId===track && a.status==="approved" && /^[a-fA-F0-9]{64}$/.test(a.sha256??""))
    .map(a=>[a.artifactId,a])
);

if(approved.size===0){
  console.log("EVIDENCE-BACKED CURRICULUM MAP: BLOCKED");
  console.log("No approved syllabus artifact with a valid SHA-256 is available.");
  console.log("No curriculum facts are accepted or inferred.");
  process.exit(0);
}

if(map.trackId!==track) fail("curriculum map track mismatch");
const linked=new Set(map.evidenceIds??[]);
for(const id of linked) if(!approved.has(id)) fail("map references evidence that is not approved for this track: "+id);

const hierarchy=[];
for(const subject of map.subjects??[]){
  hierarchy.push({nodeId:subject.subjectId,parentId:null,nodeType:"subject",title:subject.title,evidenceIds:subject.evidenceIds??[]});
  for(const chapter of subject.chapters??[]){
    hierarchy.push({nodeId:chapter.chapterId,parentId:subject.subjectId,nodeType:"chapter",title:chapter.title,evidenceIds:chapter.evidenceIds??[]});
    for(const topic of chapter.topics??[]){
      hierarchy.push({nodeId:topic.topicId,parentId:chapter.chapterId,nodeType:"topic",title:topic.title,evidenceIds:topic.evidenceIds??[]});
      for(const subtopic of topic.subtopics??[]){
        hierarchy.push({nodeId:subtopic.subtopicId,parentId:topic.topicId,nodeType:"subtopic",title:subtopic.title,evidenceIds:subtopic.evidenceIds??[]});
      }
    }
  }
}

const ids=new Set();
for(const node of hierarchy){
  if(ids.has(node.nodeId)) fail("duplicate node ID: "+node.nodeId);
  ids.add(node.nodeId);
  if(!node.title?.trim()) fail("empty title: "+node.nodeId);
  if(!Array.isArray(node.evidenceIds)||node.evidenceIds.length===0) fail("node has no evidence linkage: "+node.nodeId);
  for(const id of node.evidenceIds){
    if(!linked.has(id)) fail("node evidence is not linked at map level: "+node.nodeId+" -> "+id);
    if(!approved.has(id)) fail("node evidence is not approved: "+node.nodeId+" -> "+id);
  }
  if(node.parentId!==null && !ids.has(node.parentId)) fail("parent node must precede child: "+node.nodeId);
}

if(errors.length){
  console.error("EVIDENCE-BACKED CURRICULUM MAP: INVALID");
  errors.forEach(e=>console.error("- "+e));
  process.exit(1);
}
console.log("EVIDENCE-BACKED CURRICULUM MAP: VALID");
console.log("Approved evidence artifacts: "+approved.size);
console.log("Curriculum nodes: "+hierarchy.length);
console.log("Every node has explicit approved evidence linkage.");
