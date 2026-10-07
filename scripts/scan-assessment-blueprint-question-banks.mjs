#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const bp=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const ar=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-registry.json"),"utf8"));
const outDir=path.join(root,"config/assessment-blueprint-coverage");
fs.mkdirSync(outDir,{recursive:true});

function load(rel){
  const p=path.resolve(root,rel);
  if(!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p,"utf8"));
}
function inc(m,k){m[k]=(m[k]||0)+1;}

for(const [id,b] of Object.entries(bp.blueprints||{})){
  const assessments=Object.values(ar.assessments||{}).filter(x=>x.blueprint_id===id);
  const a=assessments[0];
  if(!a){console.error(id+": no assessment references blueprint");process.exitCode=1;continue;}

  const pub=load(a.question_bank_public);
  const key=load(a.answer_key);
  const missing=new Set();
  const ids=new Set();
  const keyIds=new Set();
  const sections={};
  const topics={};
  const difficulty={easy:0,medium:0,hard:0};
  let eligibleQuestions=0;

  const requiredSections=Object.fromEntries(
    (b.exam_structure?.sections||[]).map(s=>[s.id,s.question_count])
  );

  if(!Array.isArray(pub)) missing.add("question_bank");
  if(!Array.isArray(key)) missing.add("private_answer_key");

  if(Array.isArray(pub) && Array.isArray(key)){
    for(const q of pub){
      let eligible=true;
      if(!q?.question_id || ids.has(q.question_id)){
        missing.add("unique_question_id"); eligible=false;
      } else ids.add(q.question_id);

      for(const field of ["section_id","subject","topic","subtopic","language","difficulty","review_status"]){
        if(typeof q[field]!=="string" || !q[field].trim()){
          missing.add(field); eligible=false;
        }
      }
      if(!["easy","medium","hard"].includes(q.difficulty)){
        missing.add("difficulty"); eligible=false;
      }
      if(q.exam_id==null || !String(q.exam_id).trim()){missing.add("exam_id"); eligible=false;}
      if(q.age_band==null || !String(q.age_band).trim()){missing.add("age_band"); eligible=false;}
      if(q.review_status!=="reviewed"){missing.add("review_status"); eligible=false;}
      if(!Array.isArray(q.options) || q.options.length!==4 || new Set(q.options).size!==4){
        missing.add("four_unique_options"); eligible=false;
      }
      if(Object.hasOwn(q,"correct_option_index") || Object.hasOwn(q,"explanation") || Object.hasOwn(q,"answer")){
        missing.add("public_private_separation"); eligible=false;
      }
      if(q.section_id && requiredSections[q.section_id]==null){
        missing.add("unknown_section_id"); eligible=false;
      }

      if(q.section_id) inc(sections,q.section_id);
      if(q.subject && q.topic && q.subtopic) inc(topics,[q.subject,q.topic,q.subtopic].join("::"));
      if(difficulty[q.difficulty]!=null) difficulty[q.difficulty]++;

      if(eligible) eligibleQuestions++;
    }

    for(const k of key){
      if(!k?.question_id || keyIds.has(k.question_id)){
        missing.add("unique_private_question_id"); continue;
      }
      keyIds.add(k.question_id);
      if(!ids.has(k.question_id)) missing.add("orphan_private_answer_key");
      if(!Number.isInteger(k.correct_option_index) || k.correct_option_index<0 || k.correct_option_index>3) missing.add("private_answer_index");
      if(typeof k.explanation!=="string" || k.explanation.trim().length<12) missing.add("private_explanation");
      if(k.review_status!=="reviewed") missing.add("private_review_status");
    }

    for(const qid of ids) if(!keyIds.has(qid)) missing.add("private_answer_key");
    for(const qid of keyIds) if(!ids.has(qid)) missing.add("orphan_private_answer_key");
    if(ids.size!==keyIds.size) missing.add("public_private_count_parity");
  }

  const sectionCoverage={};
  for(const [sid,n] of Object.entries(requiredSections)){
    sectionCoverage[sid]={required:n,available:sections[sid]||0};
  }

  const reasons=[];
  if(eligibleQuestions<b.question_count) reasons.push("Eligible question inventory is below blueprint question_count.");
  if(missing.size) reasons.push("Question-level eligibility, section metadata, review, public/private separation, or private-key requirements are incomplete.");
  if(Object.values(sectionCoverage).some(x=>x.available<x.required)) reasons.push("One or more required sections lack sufficient inventory.");
  if(b.status!=="ready") reasons.push("Blueprint is not ready; difficulty/topic quotas must not be fabricated.");

  const report={
    version:2,
    blueprint_id:id,
    assessment_id:a.assessment_id,
    source:{public_bank:a.question_bank_public,private_bank:a.answer_key},
    inventory:{
      reviewed_questions:Array.isArray(pub)?pub.length:0,
      eligible_questions:eligibleQuestions,
      private_keys:Array.isArray(key)?key.length:0
    },
    coverage:{
      sections:sectionCoverage,
      difficulty:{
        easy:{available:difficulty.easy,required:b.status==="ready"?(b.difficulty_distribution?.easy||0):0},
        medium:{available:difficulty.medium,required:b.status==="ready"?(b.difficulty_distribution?.medium||0):0},
        hard:{available:difficulty.hard,required:b.status==="ready"?(b.difficulty_distribution?.hard||0):0}
      },
      topics,
      eligibility:{all_required:missing.size===0,missing:[...missing]}
    },
    status:"blocked",
    blocked_reasons:reasons.length?reasons:["No independently reviewed blueprint distribution evidence is available."]
  };

  if(b.status==="ready" &&
     eligibleQuestions>=b.question_count &&
     missing.size===0 &&
     Object.values(sectionCoverage).every(x=>x.available>=x.required) &&
     ["easy","medium","hard"].every(k=>difficulty[k]>=Number(report.coverage.difficulty[k].required||0))){
    report.status="ready";
    report.blocked_reasons=[];
  }

  fs.writeFileSync(path.join(outDir,id+".json"),JSON.stringify(report,null,2)+"\n");
}

console.log("ASSESSMENT BLUEPRINT BANK SCANNER: COMPLETE");
