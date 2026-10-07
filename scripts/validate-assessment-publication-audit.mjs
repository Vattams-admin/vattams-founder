#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const audits=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-publication-audit.json"),"utf8"));
const errors=[];
const sha=rel=>{
 const p=path.resolve(root,rel);
 if(!fs.existsSync(p)) return null;
 const value=JSON.parse(fs.readFileSync(p,"utf8"));
 return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
};
for(const [id,a] of Object.entries(registry.assessments||{})){
 const audit=audits.assessments?.[id];
 if(a.status==="draft") continue;
 if(!audit){errors.push(id+": non-draft assessment requires publication audit");continue;}
 if(audit.version!==1)errors.push(id+": audit version must be 1");
 if(audit.assessmentId!==id)errors.push(id+": audit assessmentId mismatch");
 if(audit.blueprintId!==a.blueprint_id)errors.push(id+": audit blueprintId mismatch");
 if(audit.answerKeyPrivate!==true)errors.push(id+": audit answerKeyPrivate must be true");
 if(audit.reviewStatus!=="reviewed"&&audit.reviewStatus!=="approved")errors.push(id+": audit reviewStatus invalid");
 if(!Array.isArray(audit.sourceEvidence)||!audit.sourceEvidence.length)errors.push(id+": audit sourceEvidence required");
 const ph=sha(a.question_bank_public),kh=sha(a.answer_key);
 if(!ph||audit.publicBankSha256!==ph)errors.push(id+": audit public bank hash mismatch");
 if(!kh||audit.privateAnswerKeySha256!==kh)errors.push(id+": audit private key hash mismatch");
 if(audit.coverageStatus!=="ready")errors.push(id+": audit coverageStatus must be ready");
 if(!Array.isArray(audit.auditTrail)||!audit.auditTrail.length)errors.push(id+": auditTrail required");
 if(["reviewed","published"].includes(a.status)){
  if(!audit.approvedBy||!audit.approvedAt)errors.push(id+": approval identity and timestamp required");
 }
 if(a.status==="published" && (!audit.publishedAt || audit.decision!=="published"))errors.push(id+": published assessment requires published audit decision and timestamp");
}
if(errors.length){console.error("ASSESSMENT PUBLICATION AUDIT: INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1)}
console.log("ASSESSMENT PUBLICATION AUDIT: VALID");
