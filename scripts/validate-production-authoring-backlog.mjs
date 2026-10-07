import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const b=JSON.parse(fs.readFileSync(path.join(root,"config/production-authoring-backlog.json"),"utf8"));
const errors=[];
const fail=(m)=>errors.push(m);
if(b.totalTracks!==948) fail("school backlog must contain 948 atomic tracks");
if(b.tracks.length!==b.totalTracks) fail("totalTracks does not match entries");
const ids=new Set();
for(const t of b.tracks){
  if(ids.has(t.trackId)) fail("duplicate trackId "+t.trackId);
  ids.add(t.trackId);
  if(!Number.isInteger(t.classNumber) || t.classNumber < 1 || t.classNumber > 12) fail("invalid class "+t.trackId);
  if(!["national","state_board","matriculation","international"].includes(t.scope)) fail("invalid scope "+t.trackId);
  for(const k of ["curriculum_map","subject_map","chapter_map","lesson_notes","practice","revision","mock_test","official_attempt"]) if(t.packageStatus?.[k]!=="not_started") fail("unexpected initial package state "+t.trackId+"/"+k);
}
if(errors.length){console.error("PRODUCTION AUTHORING BACKLOG INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("PRODUCTION AUTHORING BACKLOG VALID");
console.log("Atomic school tracks: "+b.totalTracks);
