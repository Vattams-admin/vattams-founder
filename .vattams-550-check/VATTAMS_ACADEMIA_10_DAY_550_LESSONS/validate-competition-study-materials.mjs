import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(".vattams-550-check/VATTAMS_ACADEMIA_10_DAY_550_LESSONS");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json") && name !== "ALL_550_LESSONS.json" && name !== "manifest.json");
const competitionFiles = files.filter((name) => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  return data.course?.category === "competition";
});

const failures = [];
for (const file of competitionFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const lessons = data.lessons ?? [];
  const course = data.course?.name ?? file;
  if (lessons.length < 10) failures.push(`${course}: fewer than 10 lessons`);
  if (lessons.some((x) => x.status !== "ready_for_production")) {
    failures.push(`${course}: lessons are not marked ready_for_production`);
  }
  const examples = new Set(lessons.map((x) => JSON.stringify(x.examples ?? [])));
  const activities = new Set(lessons.map((x) => String(x.practical_activity ?? "").trim()));
  const guided = new Set(lessons.map((x) => String(x.guided_practice ?? "").trim()));
  const independent = new Set(lessons.map((x) => String(x.independent_practice ?? "").trim()));
  if (examples.size < Math.min(lessons.length, 8)) failures.push(`${course}: insufficient lesson-specific examples`);
  if (activities.size < Math.min(lessons.length, 8)) failures.push(`${course}: insufficient lesson-specific activities`);
  if (guided.size < Math.min(lessons.length, 8)) failures.push(`${course}: insufficient lesson-specific guided practice`);
  if (independent.size < Math.min(lessons.length, 8)) failures.push(`${course}: insufficient lesson-specific independent practice`);
  const required = ["objective","core_teaching_content","examples","guided_practice","independent_practice","assessment_checkpoint","student_task","reflection_completion"];
  for (const field of required) if (lessons.some((x) => !String(x[field] ?? "").trim())) failures.push(`${course}: missing ${field}`);
}

console.log(`Competition study packages found: ${competitionFiles.length}`);
console.log(`Manifest competition count: ${manifest.course_categories?.competition ?? "unknown"}`);
if (failures.length) {
  console.log("RESULT: FAILED");
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}
console.log("RESULT: PASS");
