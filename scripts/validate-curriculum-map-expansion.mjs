import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const mapPath=path.join(root,"content/school/cbse/class-1/curriculum-map.json");
const map=JSON.parse(fs.readFileSync(mapPath,"utf8"));
const errors=[];
const fail=(m)=>errors.push(m);
const ids=new Set();

const addId=(id,label)=>{
  if(typeof id!=="string"||!id.trim()) fail(label+" id is missing");
  else if(ids.has(id)) fail("duplicate curriculum id: "+id);
  else ids.add(id);
};

if(map.trackId!=="school-cbse-class-1") fail("wrong track");
if(!Array.isArray(map.evidenceIds)) fail("evidenceIds must be an array");
if(new Set(map.evidenceIds).size!==map.evidenceIds.length) fail("duplicate evidence IDs");
if(!Array.isArray(map.subjects)) fail("subjects must be an array");
if(!map.governance || typeof map.governance.contentAuthoringAllowed!=="boolean" || typeof map.governance.publicationAllowed!=="boolean") fail("governance authoring/publication flags are required");

map.subjects.forEach((subject,si)=>{
  addId(subject.subjectId,"subject["+si+"]");
  if(typeof subject.title!=="string"||!subject.title.trim()) fail("subject["+si+"] title is missing");
  if(!Array.isArray(subject.chapters)) fail("subject["+si+"] chapters must be an array");
  (subject.chapters||[]).forEach((chapter,ci)=>{
    addId(chapter.chapterId,"chapter["+si+"]["+ci+"]");
    if(typeof chapter.title!=="string"||!chapter.title.trim()) fail("chapter["+si+"]["+ci+"] title is missing");
    if(!Array.isArray(chapter.topics)) fail("chapter["+si+"]["+ci+"] topics must be an array");
    (chapter.topics||[]).forEach((topic,ti)=>{
      addId(topic.topicId,"topic["+si+"]["+ci+"]["+ti+"]");
      if(typeof topic.title!=="string"||!topic.title.trim()) fail("topic["+si+"]["+ci+"]["+ti+"] title is missing");
      if(!Array.isArray(topic.subtopics)) fail("topic["+si+"]["+ci+"]["+ti+"] subtopics must be an array");
      (topic.subtopics||[]).forEach((subtopic,ui)=>{
        addId(subtopic.subtopicId,"subtopic["+si+"]["+ci+"]["+ti+"]["+ui+"]");
        if(typeof subtopic.title!=="string"||!subtopic.title.trim()) fail("subtopic["+si+"]["+ci+"]["+ti+"]["+ui+"] title is missing");
      });
    });
  });
});

const nodeCount={subjects:map.subjects.length,chapters:0,topics:0,subtopics:0};
map.subjects.forEach(s=>(s.chapters||[]).forEach(c=>{
  nodeCount.chapters++;
  (c.topics||[]).forEach(t=>{
    nodeCount.topics++;
    nodeCount.subtopics+=(t.subtopics||[]).length;
  });
}));

const hasCurriculum=Object.values(nodeCount).some((n)=>n>0);
if(hasCurriculum && map.evidenceIds.length===0) fail("curriculum nodes cannot be authored before approved evidence is linked");
if(map.status!=="draft" && map.evidenceIds.length===0) fail("non-draft map cannot exist without evidence");
if(map.status==="published" && map.governance.publicationAllowed!==true) fail("published map must explicitly allow publication");
if(map.evidenceIds.length===0 && (map.governance.contentAuthoringAllowed!==false || map.governance.publicationAllowed!==false)) fail("blocked map must keep authoring/publication disabled");

if(errors.length){
  console.error("CURRICULUM MAP EXPANSION INVALID");
  errors.forEach(e=>console.error("- "+e));
  process.exit(1);
}
console.log("CURRICULUM MAP EXPANSION VALID");
console.log("Track: "+map.trackId);
console.log("Nodes: "+JSON.stringify(nodeCount));
console.log("Evidence links: "+map.evidenceIds.length);
console.log(map.evidenceIds.length===0 ? "STATE: BLOCKED — awaiting approved evidence" : "STATE: EVIDENCE-LINKED");
