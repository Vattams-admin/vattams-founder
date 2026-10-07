#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const bp=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const ar=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const outDir=path.join(root,"config/assessment-blueprint-coverage"); fs.mkdirSync(outDir,{recursive:true});
function load(rel){const p=path.resolve(root,rel);if(!fs.existsSync(p))return null;return JSON.parse(fs.readFileSync(p,"utf8"));}
function inc(m,k){m[k]=(m[k]||0)+1;}
for(const [id,b] of Object.entries(bp.blueprints||{})){
 const a=Object.values(ar.assessments||{}).find(x=>x.blueprint_id===id);
 if(!a){console.error(id+": no assessment references blueprint");process.exitCode=1;continue;}
 const pub=load(a.question_bank_public), key=load(a.answer_key), missing=new Set(), ids=new Set(), keyIds=new Set();
 const sections={}, topics={}, difficulty={easy:0,medium:0,hard:0};
 if(!Array.isArray(pub)||!Array.isArray(key)){missing.add("question_bank");}
 else {
  for(const q of pub){
   if(!q?.question_id||ids.has(q.question_id)){missing.add("unique_question_id");continue;} ids.add(q.question_id);
   for(const f of ["subject","topic","subtopic","language","difficulty","review_status"]) if(typeof q[f]!=="string"||!q[f].trim()) missing.add(f);
   if(!["easy","medium","hard"].includes(q.difficulty)) missing.add("difficulty");
   inc(sections,q.section_id||q.subject||"unmapped");
   inc(topics,[q.subject,q.topic,q.subtopic].map(x=>x||"unmapped").join("::"));
   if(difficulty[q.difficulty]!=null)difficulty[q.difficulty]++;
   if(q.exam_id==null)missing.add("exam_id"); if(q.age_band==null)missing.add("age_band");
   if(q.review_status!=="reviewed")missing.add("review_status");
   if(Object.hasOwn(q,"correct_option_index")||Object.hasOwn(q,"explanation"))missing.add("public_private_separation");
  }
  for(const k of key){if(!k?.question_id||keyIds.has(k.question_id)){missing.add("unique_private_question_id");continue;}keyIds.add(k.question_id);}
  for(const qid of ids)if(!keyIds.has(qid))missing.add("private_answer_key");
 }
 const required=Object.fromEntries((b.exam_structure?.sections||[]).map(s=>[s.id,s.question_count]));
 const sectionCoverage={}; for(const [sid,n] of Object.entries(required))sectionCoverage[sid]={required:n,available:sections[sid]||0};
 const reasons=[]; if((pub?.length||0)<b.question_count)reasons.push("Eligible question inventory is below blueprint question_count.");
 if(missing.size)reasons.push("Question-level eligibility, review, public/private separation, or private-key requirements are incomplete.");
 if(Object.values(sectionCoverage).some(x=>x.available<x.required))reasons.push("One or more required sections lack sufficient inventory.");
 const report={version:1,blueprint_id:id,assessment_id:a.assessment_id,source:{public_bank:a.question_bank_public,private_bank:a.answer_key},inventory:{reviewed_questions:pub?.length||0,eligible_questions:pub?.length||0,private_keys:key?.length||0},coverage:{sections:sectionCoverage,difficulty:{easy:{available:difficulty.easy,required:0},medium:{available:difficulty.medium,required:0},hard:{available:difficulty.hard,required:0}},topics,eligibility:{all_required:missing.size===0,missing:[...missing]}},status:"blocked",blocked_reasons:reasons.length?reasons:["No independently reviewed blueprint distribution evidence is available."]};
 fs.writeFileSync(path.join(outDir,id+".json"),JSON.stringify(report,null,2)+"\n");
}
console.log("ASSESSMENT BLUEPRINT BANK SCANNER: COMPLETE");