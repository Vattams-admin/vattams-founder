import fs from "node:fs";
import path from "node:path";

const root = path.resolve("content/competition-study-materials");
const blueprint = JSON.parse(fs.readFileSync(path.join(root, "competition-study-blueprints.json"), "utf8"));
const outDir = path.join(root, "draft-packages");
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

for (const [courseName, topics] of Object.entries(blueprint.competitions)) {
  const courseId = slug(courseName);
  const lessons = topics.map((topic, i) => ({
    title: `Lesson ${i + 1}: ${topic}`,
    objective: `By the end of this lesson, the learner will explain the core ideas of ${topic}, apply them to unfamiliar competition-style problems, justify the selected method, and identify at least one common distractor or misconception.`,
    core_teaching_content: `AUTHORING REQUIRED — ${courseName} / ${topic}. Develop a learner-facing explanation that defines the concept, establishes prerequisite knowledge, demonstrates the reasoning process, addresses common misconceptions, and connects the concept to competition-style decision making. Include precise terminology and age-appropriate progression rather than generic strategy language.`,
    examples: [
      `Worked example A — create a fully solved ${topic} problem with reasoning, not just the final answer.`,
      `Worked example B — create a contrasting ${topic} problem that exposes a common misconception or distractor.`,
      `Transfer example — create a novel ${topic} problem requiring the learner to choose and justify a method.`
    ],
    practical_activity: `Design a hands-on or reasoning activity specifically for ${topic}; include instructions, expected learner output, and a success criterion.`,
    guided_practice: `Create 3 scaffolded ${topic} questions: supported, independent-with-prompt, and challenge-level. Provide the teaching prompts a tutor or self-learning guide should use.`,
    independent_practice: [
      `Practice 1: foundational ${topic} application.`,
      `Practice 2: standard competition-style ${topic} application.`,
      `Practice 3: unfamiliar transfer problem using ${topic}.`,
      `Practice 4: stretch problem combining ${topic} with an earlier skill.`
    ],
    assessment_checkpoint: `Create an 8–10 item checkpoint focused on ${topic}. Require reasoning where appropriate, include plausible distractors, and define a measurable mastery threshold.`,
    student_task: `Produce a one-page ${topic} mastery note containing key rules, one worked solution, one error to avoid, and one self-created challenge question.`,
    reflection_completion: `Record what changed in your understanding of ${topic}, which distractor or misconception you can now recognise, and what evidence shows you are ready for the next lesson.`,
    status: "draft_authoring_required",
    course_id: courseId,
    course_name: courseName,
    module_id: `${courseId}-days-1-10`,
    day: i + 1,
    sort_order: i + 1,
    lesson_id: `${courseId}-days-1-10-day-${i + 1}`
  }));

  const pkg = {
    course: { id: courseId, name: courseName, category: "competition" },
    module: {
      id: `${courseId}-days-1-10`,
      title: "Days 1–10 | Competition Mastery Module",
      description: "Topic-driven authoring scaffold. Must pass editorial and quality gates before production publishing."
    },
    lessons
  };

  fs.writeFileSync(path.join(outDir, `${courseId}.json`), JSON.stringify(pkg, null, 2) + "\n");
}

console.log(`Generated ${Object.keys(blueprint.competitions).length} competition draft packages in ${outDir}`);
