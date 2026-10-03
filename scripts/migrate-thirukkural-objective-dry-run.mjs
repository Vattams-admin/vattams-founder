import fs from "node:fs";
import admin from "firebase-admin";

const PUBLIC_PATH =
  "data/thirukkural/full-bank/objective/questions.objective.public.json";

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

const objectiveQuestions = JSON.parse(
  fs.readFileSync(PUBLIC_PATH, "utf8")
);

const EXPECTED_COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const EXPECTED_COMPETITION = "Thirukkural Mastery Championship";

const errors = [];
const missingIds = [];
const mismatchedCourse = [];
const mismatchedCompetition = [];
const mismatchedQuestionText = [];
const alreadyObjective = [];
const needsObjectiveUpdate = [];

const seen = new Set();

for (const q of objectiveQuestions) {
  const id = q.question_id;

  if (seen.has(id)) {
    errors.push(`Duplicate objective ID: ${id}`);
  }

  seen.add(id);

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`${id}: expected exactly 4 options`);
  }

  if (q.question_type !== "Multiple Choice") {
    errors.push(`${id}: question_type is not Multiple Choice`);
  }
}

const snapshot = await db.collection("competition_questions").get();
const firestoreMap = new Map(
  snapshot.docs.map((doc) => [doc.id, doc.data()])
);

for (const q of objectiveQuestions) {
  const id = q.question_id;
  const existing = firestoreMap.get(id);

  if (!existing) {
    missingIds.push(id);
    continue;
  }

  if (existing.course_id !== EXPECTED_COURSE_ID) {
    mismatchedCourse.push({
      id,
      firestore: existing.course_id,
      expected: EXPECTED_COURSE_ID,
    });
  }

  if (existing.competition !== EXPECTED_COMPETITION) {
    mismatchedCompetition.push({
      id,
      firestore: existing.competition,
      expected: EXPECTED_COMPETITION,
    });
  }

  if (existing.question !== q.question) {
    mismatchedQuestionText.push(id);
  }

  if (
    existing.question_type === "Multiple Choice" &&
    Array.isArray(existing.options) &&
    existing.options.length === 4
  ) {
    alreadyObjective.push(id);
  } else {
    needsObjectiveUpdate.push(id);
  }
}

const expectedIds = new Set(objectiveQuestions.map((q) => q.question_id));

const fullBankFirestoreIds = [...firestoreMap.keys()].filter((id) =>
  id.startsWith("TKR-FULL-")
);

const unexpectedFullBankIds = fullBankFirestoreIds.filter(
  (id) => !expectedIds.has(id)
);

console.log("");
console.log("=== THIRUKKURAL OBJECTIVE MIGRATION DRY RUN ===");
console.log(`Objective source records: ${objectiveQuestions.length}`);
console.log(`Firestore competition_questions: ${snapshot.size}`);
console.log(`Expected course ID: ${EXPECTED_COURSE_ID}`);
console.log(`Expected competition: ${EXPECTED_COMPETITION}`);
console.log("");

console.log("MATCH RESULTS");
console.log(`Existing objective records: ${alreadyObjective.length}`);
console.log(`Records needing objective update: ${needsObjectiveUpdate.length}`);
console.log(`Missing objective IDs: ${missingIds.length}`);
console.log(`Course mismatches: ${mismatchedCourse.length}`);
console.log(`Competition mismatches: ${mismatchedCompetition.length}`);
console.log(`Question-text mismatches: ${mismatchedQuestionText.length}`);
console.log(`Unexpected TKR-FULL Firestore IDs: ${unexpectedFullBankIds.length}`);
console.log(`Generator duplicate IDs/errors: ${errors.length}`);
console.log("");

if (missingIds.length) {
  console.log("MISSING IDS (first 20)");
  for (const id of missingIds.slice(0, 20)) {
    console.log(`- ${id}`);
  }
  console.log("");
}

if (mismatchedCourse.length) {
  console.log("COURSE MISMATCHES (first 20)");
  for (const item of mismatchedCourse.slice(0, 20)) {
    console.log(
      `- ${item.id}: Firestore=${item.firestore}, expected=${item.expected}`
    );
  }
  console.log("");
}

if (mismatchedCompetition.length) {
  console.log("COMPETITION MISMATCHES (first 20)");
  for (const item of mismatchedCompetition.slice(0, 20)) {
    console.log(
      `- ${item.id}: Firestore=${item.firestore}, expected=${item.expected}`
    );
  }
  console.log("");
}

if (mismatchedQuestionText.length) {
  console.log("QUESTION TEXT MISMATCHES (first 20)");
  for (const id of mismatchedQuestionText.slice(0, 20)) {
    console.log(`- ${id}`);
  }
  console.log("");
}

if (unexpectedFullBankIds.length) {
  console.log("UNEXPECTED TKR-FULL IDS (first 20)");
  for (const id of unexpectedFullBankIds.slice(0, 20)) {
    console.log(`- ${id}`);
  }
  console.log("");
}

const failed =
  errors.length ||
  missingIds.length ||
  mismatchedCourse.length ||
  mismatchedCompetition.length ||
  mismatchedQuestionText.length;

if (failed) {
  console.log("RESULT: DRY RUN FAILED");
  process.exit(1);
}

console.log("RESULT: DRY RUN READY");
console.log("No Firestore writes were performed.");
