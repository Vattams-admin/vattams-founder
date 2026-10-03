import fs from "node:fs";
import admin from "firebase-admin";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const IDS = [
  ...Array.from(
    { length: 8 },
    (_, i) => `TKR-REC-${String(i + 1).padStart(2, "0")}`
  ),
  ...Array.from(
    { length: 7 },
    (_, i) => `TKR-ADH-${String(i + 1).padStart(2, "0")}`
  ),
  ...Array.from(
    { length: 8 },
    (_, i) => `TKR-MEAN-${String(i + 1).padStart(2, "0")}`
  ),
  ...Array.from(
    { length: 7 },
    (_, i) => `TKR-KNOW-${String(i + 1).padStart(2, "0")}`
  ),
];

const EXPECTED_COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const EXPECTED_COMPETITION = "Thirukkural Mastery Championship";

const snap = await db.collection("competition_questions").get();
const questions = new Map(
  snap.docs.map((doc) => [doc.id, { ref: doc.ref, data: doc.data() }])
);

const keys = new Map();

for (const id of IDS) {
  const q = questions.get(id);

  if (!q) {
    throw new Error(`Missing official question: ${id}`);
  }

  if (q.data.course_id !== EXPECTED_COURSE_ID) {
    throw new Error(`${id}: course mismatch`);
  }

  if (q.data.competition !== EXPECTED_COMPETITION) {
    throw new Error(`${id}: competition mismatch`);
  }

  const keySnap = await db
    .collection("competition_answer_keys")
    .doc(id)
    .get();

  if (!keySnap.exists) {
    throw new Error(`Missing answer key: ${id}`);
  }

  keys.set(id, keySnap.data());
}

const fullBank = await db
  .collection("competition_questions")
  .where("course_id", "==", EXPECTED_COURSE_ID)
  .get();

const fullData = fullBank.docs
  .map((doc) => doc.data())
  .filter((q) => q.question_id?.startsWith("TKR-FULL-"));

function answerPool(topic) {
  return fullData
    .filter((q) => q.topic === topic)
    .map((q) => {
      const id = q.question_id;
      const key = questions.get(id);
      return key ? key.data : null;
    })
    .filter(Boolean);
}

const rec2Answers = fullData
  .filter((q) => q.question_id?.startsWith("TKR-FULL-REC2-"))
  .map((q) => {
    const id = q.question_id;
    return null;
  });

const answerKeyCache = new Map();

for (const q of fullData) {
  const id = q.question_id;
  const k = await db
    .collection("competition_answer_keys")
    .doc(id)
    .get();

  if (k.exists) {
    answerKeyCache.set(id, k.data());
  }
}

const getAnswers = (prefix) =>
  fullData
    .filter((q) => q.question_id?.startsWith(prefix))
    .map((q) => answerKeyCache.get(q.question_id)?.answer)
    .filter(Boolean);

const rec2Pool = getAnswers("TKR-FULL-REC2-");
const recFullPool = getAnswers("TKR-FULL-REC-");

const adhPool = fullData
  .filter((q) => q.topic === "Structural Identification")
  .map((q) => answerKeyCache.get(q.question_id)?.answer)
  .filter(Boolean);

const paalNames = [
  "அறத்துப்பால்",
  "பொருட்பால்",
  "காமத்துப்பால்",
];

const adhNames = [...new Set(adhPool)];

function unique(values) {
  return [...new Set(values.filter(Boolean).map((x) => String(x).trim()))];
}

function choose(correct, pool) {
  const candidates = unique(pool).filter((x) => x !== correct);

  if (candidates.length < 3) {
    throw new Error(
      `Not enough distractors for answer: ${correct}`
    );
  }

  // Deterministic selection so regeneration does not silently
  // produce a different official paper.
  const selected = candidates.slice(0, 3);
  return [...selected, correct];
}

function makeOptions(id, answer) {
  if (id.startsWith("TKR-REC-")) {
    const number = Number(id.slice("TKR-REC-".length));

    if (number <= 4) {
      return choose(answer, rec2Pool);
    }

    return choose(answer, recFullPool);
  }

  if (id.startsWith("TKR-ADH-")) {
    return choose(answer, adhNames);
  }

  if (id.startsWith("TKR-MEAN-")) {
    const correct = String(answer).trim();

    return [
      correct,
      ...[1, 2, 3, 4]
        .map((n) => Number(correct) + n)
        .filter((n) => n <= 1330)
        .slice(0, 3)
        .map(String),
    ];
  }

  if (id === "TKR-KNOW-04") {
    const correct = String(answer).trim();

    const permutations = [
      "அறத்துப்பால், பொருட்பால், காமத்துப்பால்",
      "அறத்துப்பால், காமத்துப்பால், பொருட்பால்",
      "பொருட்பால், அறத்துப்பால், காமத்துப்பால்",
      "பொருட்பால், காமத்துப்பால், அறத்துப்பால்",
      "காமத்துப்பால், அறத்துப்பால், பொருட்பால்",
      "காமத்துப்பால், பொருட்பால், அறத்துப்பால்",
    ];

    return [correct, ...permutations.filter((x) => x !== correct).slice(0, 3)];
  }

  if (
    id === "TKR-KNOW-01" ||
    id === "TKR-KNOW-02" ||
    id === "TKR-KNOW-03" ||
    id === "TKR-KNOW-05"
  ) {
    const correct = Number(answer);

    return [
      String(correct),
      String(correct + 1),
      String(correct + 2),
      String(correct + 3),
    ];
  }

  if (id === "TKR-KNOW-06" || id === "TKR-KNOW-07") {
    return choose(answer, adhNames);
  }

  throw new Error(`Unsupported official ID: ${id}`);
}

const output = [];

for (const id of IDS) {
  const q = questions.get(id).data;
  const key = keys.get(id);

  const options = makeOptions(id, key.answer);

  if (options.length !== 4 || new Set(options).size !== 4) {
    throw new Error(`${id}: objective options are invalid`);
  }

  if (!options.includes(String(key.answer).trim())) {
    throw new Error(`${id}: correct answer missing from options`);
  }

  output.push({
    question_id: id,
    question_type: "Multiple Choice",
    options,
    answer: String(key.answer).trim(),
    explanation: key.explanation || "",
  });
}

const outPath =
  "data/thirukkural/full-bank/objective/official-30.objective.json";

fs.mkdirSync(
  "data/thirukkural/full-bank/objective",
  { recursive: true }
);

fs.writeFileSync(
  outPath,
  JSON.stringify(output, null, 2),
  "utf8"
);

console.log("OFFICIAL OBJECTIVE QUESTIONS:", output.length);
console.log("OUTPUT:", outPath);
console.log("VALIDATION: PASS");
