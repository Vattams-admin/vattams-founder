#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const blueprints=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const target=process.argv[2] || null;
const assessments=Object.entries(registry.assessments||{}).filter(([id])=>!target || id===target);
if(!assessments.length) throw new Error(target+" is not registered");

const failures=[];
const blocked=[];
const hashFile=(rel)=>{
  const p=path.resolve(root,rel);
  if(!fs.existsSync(p)) return null;
  const parsed=JSON.parse(fs.readFileSync(p,"utf8"));
  return crypto.createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
};
const read=(rel)=>{
  const p=path.resolve(root,rel);
  if(!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p,"utf8"));
};

for(const [id,a] of assessments){
  const reasons=[];
  const bp=blueprints.blueprints?.[a.blueprint_id];
  const coverage=read("config/assessment-blueprint-coverage/"+a.blueprint_id+".json");
  const manifest=read(a.bank_manifest);
  const pub=read(a.question_bank_public);
  const priv=read(a.answer_key);

  if(!a.blueprint_id) reasons.push("blueprint_id missing");
  else if(!bp) reasons.push("blueprint does not resolve");
  else if(bp.status!=="ready") reasons.push("blueprint is not ready");
  if(!coverage) reasons.push("blueprint coverage evidence missing");
  else if(coverage.status!=="ready") reasons.push("blueprint coverage is not ready");
  if(!manifest) reasons.push("packaged bank manifest missing");
  if(!Array.isArray(pub)) reasons.push("public question bank missing");
  if(!Array.isArray(priv)) reasons.push("private answer key missing");

  if(manifest){
    if(manifest.assessmentId!==id) reasons.push("manifest assessmentId mismatch");
    if(manifest.questionCount!==a.question_count) reasons.push("manifest question count mismatch");
    if(manifest.publicBank!==a.question_bank_public) reasons.push("manifest public path mismatch");
    if(manifest.privateAnswerKey!==a.answer_key) reasons.push("manifest private path mismatch");
    if(manifest.answerKeyPrivate!==true) reasons.push("manifest answerKeyPrivate is not true");
    const ph=hashFile(a.question_bank_public), kh=hashFile(a.answer_key);
    if(!ph || manifest.publicSha256!==ph) reasons.push("public bank integrity hash mismatch");
    if(!kh || manifest.privateSha256!==kh) reasons.push("private answer-key integrity hash mismatch");
  }

  if(Array.isArray(pub) && Array.isArray(priv)){
    if(pub.length!==priv.length) reasons.push("public/private question counts differ");
    if(pub.length<a.question_count) reasons.push("public inventory below assessment question_count");
    const ids=new Set();
    for(const q of pub){
      if(!q?.question_id || ids.has(q.question_id)) reasons.push("duplicate/missing public question ID");
      ids.add(q.question_id);
      if(!Array.isArray(q.options) || q.options.length!==4 || new Set(q.options).size!==4) reasons.push("invalid four-option question: "+(q.question_id||"unknown"));
      if(Object.hasOwn(q,"correct_option_index") || Object.hasOwn(q,"explanation") || Object.hasOwn(q,"answer")) reasons.push("public answer leakage: "+q.question_id);
      if(q.review_status!=="reviewed") reasons.push("unreviewed public question: "+q.question_id);
      if(typeof q.section_id!=="string" || !q.section_id.trim()) reasons.push("missing section_id: "+q.question_id);
    }
    const keyIds=new Set();
    for(const k of priv){
      if(!k?.question_id || keyIds.has(k.question_id)) reasons.push("duplicate/missing private key ID");
      keyIds.add(k.question_id);
      if(!ids.has(k.question_id)) reasons.push("orphan private key: "+k.question_id);
      if(!Number.isInteger(k.correct_option_index)||k.correct_option_index<0||k.correct_option_index>3) reasons.push("invalid private answer index: "+(k.question_id||"unknown"));
      if(typeof k.explanation!=="string"||k.explanation.trim().length<12) reasons.push("private explanation missing: "+(k.question_id||"unknown"));
      if(k.review_status!=="reviewed") reasons.push("unreviewed private key: "+(k.question_id||"unknown"));
    }
    for(const qid of ids) if(!keyIds.has(qid)) reasons.push("missing private key: "+qid);
  }

  if(reasons.length){
    if(a.status==="draft") blocked.push({assessmentId:id,reasons:[...new Set(reasons)]});
    else failures.push({assessmentId:id,reasons:[...new Set(reasons)]});
  }
}

for(const b of blocked) console.log("BLOCKED "+b.assessmentId+" (draft): "+b.reasons.join("; "));
if(failures.length){
  console.error("ASSESSMENT PRODUCTION READINESS: INVALID");
  for(const f of failures) console.error("- "+f.assessmentId+": "+f.reasons.join("; "));
  process.exit(1);
}
console.log("ASSESSMENT PRODUCTION READINESS: VALID");
console.log("Reviewed/published assessments with incomplete production evidence: 0");
