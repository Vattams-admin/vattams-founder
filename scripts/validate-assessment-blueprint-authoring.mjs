import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const file=process.argv[2]||"config/assessment-blueprint-authoring/tnpsc-group-iv-vao-mock.json";
const p=path.resolve(root,file); if(!fs.existsSync(p)) throw new Error("Missing authoring blueprint: "+file);
const x=JSON.parse(fs.readFileSync(p,"utf8")); const e=[];
const sum=Object.values(x.difficulty_distribution||{}).reduce((a,v)=>a+Number(v),0);
if(x.status!=="draft" && Math.abs(sum-1)>0.000001)e.push("difficulty_distribution must sum to 1");
const sec=(x.sections||[]).reduce((a,s)=>a+Number(s.question_count||0),0); if(sec!==x.question_count)e.push("section question counts must equal question_count");
const topics=(x.topic_distribution||[]).reduce((a,t)=>a+Number(t.question_count||0),0); if(x.status!=="draft" && topics!==x.question_count)e.push("topic question counts must equal question_count");
if(!x.provenance?.source_evidence?.length)e.push("source evidence is required"); if(!x.provenance?.authored_by)e.push("authored_by is required");
if(x.status==="approved"&&x.review?.status!=="approved")e.push("approved blueprint requires approved review");
if(x.status==="approved"&&!x.review?.reviewed_by)e.push("approved blueprint requires reviewer identity");
if(x.status==="approved"&&!x.review?.reviewed_at)e.push("approved blueprint requires review timestamp");
if(e.length){console.error("ASSESSMENT BLUEPRINT AUTHORING: INVALID");e.forEach(v=>console.error("- "+v));process.exit(1)}
console.log("ASSESSMENT BLUEPRINT AUTHORING: VALID");