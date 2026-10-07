#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=process.cwd();
const id=process.argv[2], target=process.argv[3];
if(!id||!target) throw new Error("Usage: node scripts/promote-assessment.mjs <assessmentId> <reviewed|published>");
const registryPath=path.join(root,"config/assessment-registry.json");
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const a=registry.assessments?.[id];
if(!a) throw new Error("Assessment not registered: "+id);
if(!["reviewed","published"].includes(target)) throw new Error("Target must be reviewed or published");
if(a.status==="draft"&&target==="published") throw new Error("Direct draft -> published promotion is forbidden");
if(a.status===target) throw new Error("Assessment is already "+target);
if(a.status==="published") throw new Error("Published assessments cannot be promoted again; create a new version");

const audit=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-publication-audit.json"),"utf8")).assessments?.[id];
const history=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-version-history.json"),"utf8")).assessments?.[id];
const blueprints=JSON.parse(fs.readFileSync(path.join(root,"config/assessment-blueprint-registry.json"),"utf8"));
const bp=blueprints.blueprints?.[a.blueprint_id];
const coveragePath=path.join(root,"config/assessment-blueprint-coverage",a.blueprint_id+".json");
const coverage=fs.existsSync(coveragePath)?JSON.parse(fs.readFileSync(coveragePath,"utf8")):null;

if(target==="reviewed"){
 if(a.status!=="draft") throw new Error("Only draft assessments may transition to reviewed");
 if(!bp||bp.status!=="ready") throw new Error("Blueprint must be ready before review promotion");
 if(!coverage||coverage.status!=="ready") throw new Error("Blueprint coverage must be ready before review promotion");
 if(!audit||!["reviewed","approved"].includes(audit.reviewStatus)) throw new Error("Publication audit review evidence is required");
 if(!audit.approvedBy||!audit.approvedAt) throw new Error("Explicit approval identity/timestamp required");
 if(!history||!history.currentVersion) throw new Error("Version history is required");
 a.status="reviewed";
}else{
 if(a.status!=="reviewed") throw new Error("Only reviewed assessments may transition to published");
 if(!bp||bp.status!=="ready") throw new Error("Blueprint must be ready before publication");
 if(!coverage||coverage.status!=="ready") throw new Error("Blueprint coverage must be ready before publication");
 if(!audit||audit.decision!=="approved_for_publication") throw new Error("Publication audit decision must be approved_for_publication");
 if(!audit.approvedBy||!audit.approvedAt) throw new Error("Explicit approval identity/timestamp required");
 if(!history||!history.currentVersion) throw new Error("Version history is required");
 a.status="published";
 const hash=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
 const pub=JSON.parse(fs.readFileSync(path.resolve(root,a.question_bank_public),"utf8"));
 const priv=JSON.parse(fs.readFileSync(path.resolve(root,a.answer_key),"utf8"));
 const publicHash=hash(pub), privateHash=hash(priv);
 if(audit.publicBankSha256!==publicHash||audit.privateAnswerKeySha256!==privateHash) throw new Error("Publication audit hashes do not match current assessment banks");
 if(history.currentVersion!==history.versions.at(-1)?.version) throw new Error("Version history currentVersion is invalid");
 a.release_version=history.currentVersion;
 a.release_public_sha256=publicHash;
 a.release_private_sha256=privateHash;
}
fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+"\n");
console.log("PROMOTED "+id+" -> "+target);
