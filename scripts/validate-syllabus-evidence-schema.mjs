import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const schema=JSON.parse(fs.readFileSync(path.join(root,"config/syllabus-evidence-registry.schema.json"),"utf8"));
const required=["evidenceId","trackId","sourceType","sourceTitle","sourceLocator","curriculumVersion","effectiveFrom","retrievedAt","evidenceHash","status","verifiedBy","verifiedAt"];
const errors=[];
for(const f of required) if(!schema.required_fields.includes(f)) errors.push("missing required field "+f);
if(!schema.rules.official_source_required) errors.push("official source requirement disabled");
if(!schema.rules.content_authoring_blocked_until_approved) errors.push("authoring block disabled");
if(schema.rules.superseded_evidence_cannot_authorize_new_content!==true) errors.push("superseded evidence rule missing");
if(schema.approval.no_auto_approval_from_unverified_sources!==true) errors.push("unsafe auto approval rule");
if(errors.length){console.error("SYLLABUS EVIDENCE SCHEMA INVALID");errors.forEach(e=>console.error("- "+e));process.exit(1);}
console.log("SYLLABUS EVIDENCE SCHEMA VALID");
console.log("Required fields: "+required.length);
console.log("Official source required: yes");
console.log("Authoring blocked until approved evidence: yes");
