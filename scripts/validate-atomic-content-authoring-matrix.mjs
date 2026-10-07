import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const matrix=JSON.parse(fs.readFileSync(path.join(root,"config/atomic-content-authoring-matrix.json"),"utf8"));
const registry=JSON.parse(fs.readFileSync(path.join(root,"config/india-education-registry.json"),"utf8"));
const errors=[];
const fail=(m)=>errors.push(m);
const requiredClasses=Array.from({length:12},(_,i)=>i+1);
if(JSON.stringify(matrix.school.class_range)!==JSON.stringify(requiredClasses)) fail("school class range must be 1-12");
for(const id of ["cbse","cisce-icse","cisce-isc","nios"]) if(!matrix.school.national_tracks.some(x=>x.id===id)) fail("missing national track "+id);
for(const id of ["state_board","matriculation"]) if(!matrix.school.state_tracks.some(x=>x.id===id)) fail("missing state track "+id);
for(const id of ["ib","cambridge-international","pearson-edexcel"]) if(!matrix.school.international_tracks.some(x=>x.id===id)) fail("missing international track "+id);
for(const layer of ["lesson_notes","concepts_definitions","worked_examples","practice_basic","practice_conceptual","practice_application","practice_hots","common_mistakes","key_takeaways","flash_recall","chapter_revision","weak_topic_revision","chapter_test","subject_test","mock_test","official_attempt"]) if(!matrix.school.atomic_package.includes(layer)) fail("missing school package layer "+layer);
if(registry.states_and_uts.length!==36) fail("India registry must contain 36 state/UT jurisdictions");
if(registry.languages.length<22) fail("India language registry unexpectedly reduced");
if(matrix.assessment_matrix.official.answer_release!=="never_during_attempt") fail("official answer must stay hidden during attempt");
if(matrix.assessment_matrix.official.option_order!=="randomized") fail("official options must randomize");
if(!matrix.assessment_matrix.practice.after_submission.includes("detailed_reasoning")) fail("practice must provide detailed reasoning");
if(!matrix.governance.automatic_ceo_approval.includes("does not bypass")) fail("CEO approval governance must remain gated");
if(errors.length){console.error("ATOMIC AUTHORING MATRIX INVALID"); errors.forEach(e=>console.error("- "+e)); process.exit(1);}
console.log("ATOMIC AUTHORING MATRIX VALID");
console.log("Jurisdictions: "+registry.states_and_uts.length);
console.log("Languages: "+registry.languages.length);
console.log("School classes: "+matrix.school.class_range.length);
console.log("National tracks: "+matrix.school.national_tracks.length);
console.log("State/UT tracks: "+matrix.school.state_tracks.length);
console.log("International tracks: "+matrix.school.international_tracks.length);
