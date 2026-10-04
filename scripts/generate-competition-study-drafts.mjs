import fs from "node:fs";
import path from "node:path";

const root = path.resolve("content/competition-study-materials");
const blueprint = JSON.parse(fs.readFileSync(path.join(root, "competition-study-blueprints.json"), "utf8"));
const outDir = path.join(root, "draft-packages-v2");
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

for (const [courseName, spec] of Object.entries(blueprint.competitions)) {
  const courseId = slug(courseName);
  const domains = (spec.domains ?? []).map((domain, i) => ({
    id: domain.id ?? `domain-${i + 1}`,
    title: domain.title,
    subtopics: domain.subtopics ?? [],
    expansion_required: domain.expansion_required !== false,
    resources: [],
    question_bank: [],
    assessments: [],
    revision: [],
  }));

  const pkg = {
    schema_version: "2.0.0",
    course: { id: courseId, name: courseName, category: "competition" },
    competition_model: "thirukkural_mastery",
    age_bands: spec.age_bands ?? [],
    learning_paths: spec.learning_paths ?? [],
    domains,
    capstone: spec.capstone ?? {},
    status: "draft_authoring_required"
  };

  fs.writeFileSync(path.join(outDir, `${courseId}.json`), JSON.stringify(pkg, null, 2) + "\n");
}

console.log(`Generated ${Object.keys(blueprint.competitions).length} scalable competition curriculum scaffolds in ${outDir}`);
