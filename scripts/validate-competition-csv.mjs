import fs from "node:fs";
import csv from "csv-parser";

const CSV_PATH =
  process.argv.find(
    (arg) => !arg.startsWith("--") && arg.endsWith(".csv")
  ) || "/storage/emulated/0/Download/vattams-competition-600.csv";

const rows = [];

await new Promise((resolve, reject) => {
  fs.createReadStream(CSV_PATH)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", resolve)
    .on("error", reject);
});

const required = [
  "competition",
  "question_id",
  "topic",
  "subtopic",
  "question",
  "answer",
  "explanation",
  "difficulty",
  "question_type",
  "age_band",
  "skill",
  "marks",
  "time_seconds",
  "language",
  "source_type",
  "copyright_status",
  "review_status",
];

const errors = [];

for (const field of required) {
  const missing = rows.filter(
    (r) => !String(r[field] ?? "").trim()
  ).length;

  if (missing) {
    errors.push(`${field}: ${missing} blank rows`);
  }
}

const idCounts = new Map();
const questionCounts = new Map();
const competitionCounts = new Map();
const reviewCounts = new Map();

for (const row of rows) {
  idCounts.set(
    row.question_id,
    (idCounts.get(row.question_id) || 0) + 1
  );

  const normalized = row.question
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  questionCounts.set(
    normalized,
    (questionCounts.get(normalized) || 0) + 1
  );

  competitionCounts.set(
    row.competition,
    (competitionCounts.get(row.competition) || 0) + 1
  );

  reviewCounts.set(
    row.review_status,
    (reviewCounts.get(row.review_status) || 0) + 1
  );
}

const duplicateIds = [...idCounts.entries()].filter(
  ([, count]) => count > 1
);

const duplicateQuestions = [...questionCounts.entries()].filter(
  ([, count]) => count > 1
);

if (duplicateIds.length) {
  errors.push(`duplicate question IDs: ${duplicateIds.length}`);
}

if (duplicateQuestions.length) {
  errors.push(
    `duplicate normalized questions: ${duplicateQuestions.length}`
  );
}

const invalidCounts = [...competitionCounts.entries()].filter(
  ([, count]) => count !== 30
);

if (invalidCounts.length) {
  errors.push(
    `competitions not containing exactly 30 questions: ${invalidCounts.length}`
  );
}

const invalidTypes = rows.filter(
  (r) => !["MCQ", "Short answer"].includes(r.question_type)
);

if (invalidTypes.length) {
  errors.push(`unsupported question types: ${invalidTypes.length}`);
}

console.log("");
console.log("=== VATTAMS COMPETITION CSV VALIDATOR ===");
console.log(`CSV: ${CSV_PATH}`);
console.log(`Rows: ${rows.length}`);
console.log(`Competitions: ${competitionCounts.size}`);
console.log("");

console.log("Questions per competition:");
for (const [competition, count] of competitionCounts.entries()) {
  console.log(`- ${competition}: ${count}`);
}

console.log("");
console.log("Review status:");
for (const [status, count] of reviewCounts.entries()) {
  console.log(`- ${status}: ${count}`);
}

console.log("");

if (errors.length) {
  console.log("RESULT: FAILED");

  for (const error of [...new Set(errors)]) {
    console.log(`- ${error}`);
  }

  process.exit(1);
}

console.log("RESULT: CSV VALID");
console.log("No Firebase connection.");
console.log("No Firestore reads.");
console.log("No Firestore writes.");
