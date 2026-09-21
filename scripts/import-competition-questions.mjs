import fs from "node:fs";
import csv from "csv-parser";
import admin from "firebase-admin";

const WRITE_MODE = process.argv.includes("--write");

const CSV_PATH = process.argv.find((arg) => !arg.startsWith("--") && arg.endsWith(".csv")) ||
  "/storage/emulated/0/Download/vattams-competition-600.csv";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))
  ),
});

const db = admin.firestore();

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
  const missing = rows.filter((r) => !String(r[field] ?? "").trim()).length;
  if (missing) {
    errors.push(`${field}: ${missing} blank rows`);
  }
}

const idCounts = new Map();
const questionCounts = new Map();

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
}

const duplicateIds = [...idCounts.entries()]
  .filter(([, count]) => count > 1);

const duplicateQuestions = [...questionCounts.entries()]
  .filter(([, count]) => count > 1);

if (duplicateIds.length) {
  errors.push(`duplicate question IDs: ${duplicateIds.length}`);
}

if (duplicateQuestions.length) {
  errors.push(`duplicate normalized questions: ${duplicateQuestions.length}`);
}

const courseSnapshot = await db
  .collection("courses")
  .where("is_competition", "==", true)
  .get();

const coursesByName = new Map();

for (const doc of courseSnapshot.docs) {
  const data = doc.data();

  coursesByName.set(data.name, {
    id: doc.id,
    slug: data.slug,
    is_published: data.is_published === true,
  });
}

const competitionCounts = new Map();

for (const row of rows) {
  competitionCounts.set(
    row.competition,
    (competitionCounts.get(row.competition) || 0) + 1
  );

  if (!coursesByName.has(row.competition)) {
    errors.push(`missing Firestore competition course: ${row.competition}`);
  }
}

const invalidCounts = [...competitionCounts.entries()]
  .filter(([, count]) => count !== 30);

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

const unpublishedCourses = [...coursesByName.entries()]
  .filter(([, c]) => !c.is_published);

if (unpublishedCourses.length) {
  errors.push(`unpublished competition courses: ${unpublishedCourses.length}`);
}

if (errors.length) {
  console.log("");
  console.log("RESULT: FAILED");

  for (const error of [...new Set(errors)]) {
    console.log(`- ${error}`);
  }

  process.exit(1);
}

console.log("");
console.log("=== VATTAMS COMPETITION QUESTION IMPORT ===");
console.log(`Mode: ${WRITE_MODE ? "WRITE" : "DRY RUN"}`);
console.log(`Rows: ${rows.length}`);
console.log(`Competitions: ${competitionCounts.size}`);
console.log("Duplicate IDs: 0");
console.log("Duplicate questions: 0");
console.log("Unpublished competition courses: 0");
console.log("");

if (!WRITE_MODE) {
  console.log("RESULT: READY");
  console.log("No Firestore writes were performed.");
  process.exit(0);
}

const existingQuestions = await db.collection("competition_questions").get();
const existingKeys = new Set(existingQuestions.docs.map((doc) => doc.id));

const existingAnswerKeys = await db.collection("competition_answer_keys").get();
const existingAnswerKeyIds = new Set(
  existingAnswerKeys.docs.map((doc) => doc.id)
);

let questionWrites = 0;
let answerKeyWrites = 0;
let skipped = 0;

let batch = db.batch();
let batchCount = 0;

async function commitBatch() {
  if (batchCount === 0) return;

  await batch.commit();
  batch = db.batch();
  batchCount = 0;
}

for (const row of rows) {
  const course = coursesByName.get(row.competition);

  const questionRef = db
    .collection("competition_questions")
    .doc(row.question_id);

  const answerKeyRef = db
    .collection("competition_answer_keys")
    .doc(row.question_id);

  if (
    existingKeys.has(row.question_id) ||
    existingAnswerKeyIds.has(row.question_id)
  ) {
    skipped++;
    continue;
  }

  const questionData = {
    question_id: row.question_id,
    course_id: course.id,
    competition: row.competition,
    topic: row.topic,
    subtopic: row.subtopic,
    question: row.question,
    question_type: row.question_type,
    difficulty: row.difficulty,
    age_band: row.age_band,
    skill: row.skill,
    marks: Number(row.marks),
    time_seconds: Number(row.time_seconds),
    language: row.language,
    source_type: row.source_type,
    source_reference: row.source_reference || null,
    copyright_status: row.copyright_status,
    review_status: row.review_status,
    is_published: true,
  };

  const answerKeyData = {
    question_id: row.question_id,
    answer: row.answer,
    explanation: row.explanation,
  };

  batch.set(questionRef, questionData);
  batch.set(answerKeyRef, answerKeyData);

  batchCount += 2;
  questionWrites++;
  answerKeyWrites++;

  if (batchCount >= 400) {
    await commitBatch();
  }
}

await commitBatch();

console.log(`Question documents written: ${questionWrites}`);
console.log(`Answer-key documents written: ${answerKeyWrites}`);
console.log(`Existing rows skipped: ${skipped}`);
console.log("");
console.log("RESULT: IMPORT COMPLETE");
