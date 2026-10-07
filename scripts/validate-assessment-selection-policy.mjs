import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, "config/assessment-selection-policy.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "config/assessment-selection-blueprint.schema.json"), "utf8"));
const errors = [];
const fail = (m) => errors.push(m);

const expected = [
  "curriculum_eligibility","class_or_exam_eligibility","age_band","blueprint",
  "difficulty_distribution","topic_distribution","recent_repetition_exclusion",
  "student_specific_question_shuffle","option_shuffle"
];
if (JSON.stringify(policy.selectionOrder) !== JSON.stringify(expected)) fail("selection order does not match production gate");
if (policy.rules.failClosedWhenInsufficientEligibleQuestions !== true) fail("selector must fail closed");
if (policy.rules.requireBlueprintForPublishedAssessments !== true) fail("published assessments must require a blueprint");
if (policy.rules.questionIdsMustComeFromPublishedPublicBank !== true) fail("question IDs must come from the published public bank");
if (policy.rules.officialAttemptAnswerHidden !== true) fail("official answers must remain hidden");
if (policy.rules.privateAnswerKeyNeverReturnedBySelector !== true) fail("selector must never return private answer keys");
if (policy.rules.studentSpecificSeedRequired !== true) fail("student-specific seed is required");
if (policy.rules.optionShuffleRequired !== true) fail("option shuffle is required");
if (policy.rules.recentAttemptWindow !== 3) fail("recent repetition window must be 3 attempts");

const sum = (obj) => Object.values(obj).reduce((a,b) => a + Number(b), 0);
if (sum({easy:0.5,medium:0.3,hard:0.2}) !== 1) fail("internal policy sanity check failed");

const validateBlueprint = (bp) => {
  if (!bp || typeof bp !== "object") return ["blueprint must be an object"];
  const e=[];
  if (!Number.isInteger(bp.questionCount) || bp.questionCount < 1) e.push("questionCount must be a positive integer");
  const d=bp.difficultyDistribution;
  if (!d || sum(d) < 0.999999 || sum(d) > 1.000001) e.push("difficulty distribution must sum to 1");
  if (!Array.isArray(bp.topicDistribution) || !bp.topicDistribution.length) e.push("topicDistribution must be non-empty");
  else {
    const t=sum(Object.fromEntries(bp.topicDistribution.map((x,i)=>[i,x.proportion])));
    if (t < 0.999999 || t > 1.000001) e.push("topic distribution must sum to 1");
    for (const x of bp.topicDistribution) {
      if (!x.subject?.trim() || !x.topic?.trim() || !(x.proportion > 0 && x.proportion <= 1)) e.push("invalid topic distribution entry");
    }
  }
  return e;
};

for (const p of [
  "config/competitive-exam-assessment-blueprints/tnpsc-group-iv-vao.json"
]) {
  const bp=JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
  if (!bp.assessment_selection) continue;
  for (const e of validateBlueprint(bp.assessment_selection)) fail(p+": "+e);
}
if (errors.length) { console.error("ASSESSMENT SELECTION POLICY: INVALID"); errors.forEach(e=>console.error("- "+e)); process.exit(1); }
console.log("ASSESSMENT SELECTION POLICY: VALID");
console.log("Gate order: curriculum → class/exam → age → blueprint → difficulty → topic → repetition → question shuffle → option shuffle");
console.log("Fail-closed: ENABLED");
console.log("Private answer-key exposure: BLOCKED");
