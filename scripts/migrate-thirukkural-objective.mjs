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

if (objectiveQuestions.length !== 9443) {
  throw new Error(
    `Expected 9443 objective questions, found ${objectiveQuestions.length}`
  );
}

const snapshot = await db.collection("competition_questions").get();
const firestoreMap = new Map(
  snapshot.docs.map((doc) => [doc.id, doc])
);

const errors = [];
const updates = [];

for (const q of objectiveQuestions) {
  const id = q.question_id;
  const doc = firestoreMap.get(id);

  if (!doc) {
    errors.push(`${id}: Firestore document missing`);
    continue;
  }

  const existing = doc.data();

  if (existing.course_id !== EXPECTED_COURSE_ID) {
    errors.push(
      `${id}: course mismatch (${existing.course_id})`
    );
    continue;
  }

  if (existing.competition !== EXPECTED_COMPETITION) {
    errors.push(
      `${id}: competition mismatch (${existing.competition})`
    );
    continue;
  }

  if (existing.question !== q.question) {
    errors.push(`${id}: question text mismatch`);
    continue;
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`${id}: objective options are not exactly 4`);
    continue;
  }

  if (new Set(q.options).size !== 4) {
    errors.push(`${id}: duplicate objective options`);
    continue;
  }

  updates.push({
    ref: doc.ref,
    data: {
      question_type: "Multiple Choice",
      options: q.options,
    },
  });
}

if (errors.length) {
  console.log("RESULT: BLOCKED");
  console.log(`Safety errors: ${errors.length}`);

  for (const error of errors.slice(0, 30)) {
    console.log(`- ${error}`);
  }

  process.exit(1);
}

console.log("");
console.log("=== THIRUKKURAL OBJECTIVE MIGRATION ===");
console.log(`Source objective questions: ${objectiveQuestions.length}`);
console.log(`Firestore documents checked: ${snapshot.size}`);
console.log(`Documents to update: ${updates.length}`);
console.log("");

if (updates.length !== 9443) {
  throw new Error(
    `Safety check failed: expected 9443 updates, got ${updates.length}`
  );
}

let batch = db.batch();
let batchCount = 0;
let committed = 0;

async function commitBatch() {
  if (batchCount === 0) return;

  await batch.commit();
  committed += batchCount;

  batch = db.batch();
  batchCount = 0;

  console.log(`Committed updates: ${committed}/9443`);
}

for (const update of updates) {
  batch.update(update.ref, update.data);
  batchCount++;

  // Keep well below Firestore's 500-operation batch limit.
  if (batchCount === 400) {
    await commitBatch();
  }
}

await commitBatch();

console.log("");
console.log(`Firestore updates completed: ${committed}`);
console.log("Answer-key collection was not modified.");
console.log("Official 30-question IDs were not modified.");
console.log("RESULT: MIGRATION COMPLETE");
