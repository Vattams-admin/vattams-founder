import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const authorPath=process.argv[2]||"config/assessment-blueprint-authoring/tnpsc-group-iv-vao-mock.json";
const author=JSON.parse(fs.readFileSync(path.resolve(root,authorPath),"utf8"));
const registryPath=path.resolve(root,"config/assessment-blueprint-registry.json");
const registry=JSON.parse(fs.readFileSync(registryPath,"utf8"));
const bp=registry.blueprints?.[author.blueprint_id]; const e=[];
if(!bp)e.push("blueprint does not exist in executable registry");
if(author.status!=="approved"||author.review?.status!=="approved")e.push("authoring blueprint is not approved");
if(!author.review?.reviewed_by||!author.review?.reviewed_at)e.push("review identity and timestamp required");
if(!author.provenance?.source_evidence?.length)e.push("source evidence required");
if(author.question_count!==bp?.question_count)e.push("question_count mismatch");
if(JSON.stringify(author.sections)!==JSON.stringify(bp?.exam_structure?.sections))e.push("section structure mismatch");
if(e.length){console.error("ASSESSMENT BLUEPRINT PROMOTION: BLOCKED");e.forEach(x=>console.error("- "+x));process.exit(1)}
const promoted={...bp,status:"blocked",authoring_source:authorPath,blocked_reason:"Authoring approval exists, but executable promotion still requires computed question-bank coverage and approved difficulty/topic distributions."};
registry.blueprints[author.blueprint_id]=promoted;
fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+"\n");
console.log("ASSESSMENT BLUEPRINT PROMOTION: AUTHORING LINK VERIFIED; RUNTIME REMAINS BLOCKED UNTIL COVERAGE GATE PASSES");