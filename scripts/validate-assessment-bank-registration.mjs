import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const errors=[];
function sha(rel){const p=path.resolve(root,rel);if(!fs.existsSync(p))return null;return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");}
function read(rel){const p=path.resolve(root,rel);if(!fs.existsSync(p))return null;return JSON.parse(fs.readFileSync(p,"utf8"));}
for(const [id,a] of Object.entries(registry.assessments||{})){
 const manifestPath="assessments/competitive-exam/"+a.course_id+"/"+a.assessment_id+".manifest.json";
 const m=read(manifestPath);
 if(!m){if(a.status==="reviewed"||a.status==="published")errors.push(id+": reviewed/published assessment requires packaged manifest");continue;}
 if(m.assessmentId!==id)errors.push(id+": manifest assessmentId mismatch");
 if(m.questionCount!==a.question_count)errors.push(id+": manifest question count mismatch");
 if(m.publicBank!==a.question_bank_public)errors.push(id+": manifest public bank path mismatch");
 if(m.privateAnswerKey!==a.answer_key)errors.push(id+": manifest private key path mismatch");
 if(m.answerKeyPrivate!==true)errors.push(id+": manifest answerKeyPrivate must be true");
 const ph=sha(a.question_bank_public), kh=sha(a.answer_key);
 if(ph&&m.publicSha256!==ph)errors.push(id+": public bank SHA-256 mismatch");
 if(kh&&m.privateSha256!==kh)errors.push(id+": private answer key SHA-256 mismatch");
 if((a.status==="reviewed"||a.status==="published") && (!ph||!kh))errors.push(id+": reviewed/published assessment requires both bank files");
}
if(errors.length){console.error("ASSESSMENT BANK REGISTRATION: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT BANK REGISTRATION: VALID");