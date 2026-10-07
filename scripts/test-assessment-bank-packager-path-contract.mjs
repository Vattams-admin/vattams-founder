import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root=process.cwd();
const assessmentId="assessment-bank-path-contract-fixture";
const tempInputDir=fs.mkdtempSync(path.join(os.tmpdir(),"vattams-bank-contract-"));
const inputPath=path.join(tempInputDir,"ingestion.json");
const outputDir=path.join(root,"assessments","competitive-exam","__contract-test__");
const cleanup=()=>{fs.rmSync(tempInputDir,{recursive:true,force:true});fs.rmSync(outputDir,{recursive:true,force:true});};
try{
  fs.mkdirSync(outputDir,{recursive:true});
  const packageData={
    version:"1.0.0",
    assessmentId,
    questions:[{
      questionId:"Q-CONTRACT-01",
      question:"Which option is valid for this contract test?",
      options:["A","B","C","D"],
      subject:"Contract",
      topic:"Path",
      subtopic:"Manifest",
      language:"en",
      difficulty:"easy",
      ageBand:"adult",
      examId:"contract-test",
      marks:1,
      timeSeconds:30,
      reviewStatus:"reviewed"
    }],
    answerKeys:[{
      questionId:"Q-CONTRACT-01",
      correctOptionIndex:1,
      explanation:"The second option is the reviewed answer for this contract fixture.",
      reviewStatus:"reviewed"
    }],
    governance:{
      answerKeyPrivate:true,
      sourceEvidence:["contract-test-evidence"],
      status:"approved"
    }
  };
  fs.writeFileSync(inputPath,JSON.stringify(packageData));
  execFileSync(process.execPath,["scripts/package-production-question-bank.mjs",inputPath,"assessments/competitive-exam/__contract-test__"],{cwd:root,stdio:"pipe"});
  const manifest=JSON.parse(fs.readFileSync(path.join(outputDir,assessmentId+".manifest.json"),"utf8"));
  const expectedPublic="assessments/competitive-exam/__contract-test__/"+assessmentId+".public.json";
  const expectedPrivate="assessments/competitive-exam/__contract-test__/"+assessmentId+".private.json";
  if(manifest.publicBank!==expectedPublic) throw new Error("Public manifest path contract failed: "+manifest.publicBank);
  if(manifest.privateAnswerKey!==expectedPrivate) throw new Error("Private manifest path contract failed: "+manifest.privateAnswerKey);
  console.log("ASSESSMENT BANK PATH CONTRACT: PASS");
} finally {
  cleanup();
}
