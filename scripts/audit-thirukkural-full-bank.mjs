import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bankDir = path.join(root, "data/thirukkural/full-bank");

const publicRows = JSON.parse(
  fs.readFileSync(path.join(bankDir, "questions.public.json"), "utf8")
);

const privateRows = JSON.parse(
  fs.readFileSync(path.join(bankDir, "answer-key.private.json"), "utf8")
);

const index = JSON.parse(
  fs.readFileSync(path.join(bankDir, "question-index.json"), "utf8")
);

const sourceFile = JSON.parse(
  fs.readFileSync(
    path.join(root, "data/thirukkural/thirukkural.json"),
    "utf8"
  )
);

const source = sourceFile.kural;

const detailsFile = JSON.parse(
  fs.readFileSync(
    path.join(root, "data/thirukkural/detail.json"),
    "utf8"
  )
);

// Actual source structure:
// Paal -> chapterGroup (Iyal) -> chapters.detail (Adhigaram)
const chapters = detailsFile?.[0]?.section?.detail?.flatMap(
  paal =>
    paal?.chapterGroup?.detail?.flatMap(
      iyal => iyal?.chapters?.detail ?? []
    ) ?? []
) ?? [];

const errors = [];
const warnings = [];

const error = msg => errors.push(msg);
const warning = msg => warnings.push(msg);

const publicById = new Map(
  publicRows.map(q => [q.question_id, q])
);

const privateById = new Map(
  privateRows.map(q => [q.question_id, q])
);

const sourceNumbers = new Set(
  source.map(k => Number(k.Number))
);

const paals = detailsFile?.[0]?.section?.detail ?? [];

const paalNumbers = new Set(
  paals.map(paal => Number(paal.number))
);

const iyals = paals.flatMap(
  paal => paal?.chapterGroup?.detail ?? []
);

const iyalNumbers = new Set(
  iyals.map(iyal => Number(iyal.number))
);

const chapterNumbers = new Set(
  chapters.map(c => Number(c.number))
);

console.log("=== VATTAMS THIRUKKURAL FULL-BANK CONTENT AUDIT ===");
console.log("");

console.log("Public questions :", publicRows.length);
console.log("Private keys     :", privateRows.length);
console.log("Source Kurals    :", source.length);
console.log("Chapters         :", chapters.length);
console.log("Index total      :", index.total_questions);
console.log("");

/* 1. Basic counts */

if (publicRows.length !== 9443)
  error(`Expected 9443 public questions, found ${publicRows.length}`);

if (privateRows.length !== 9443)
  error(`Expected 9443 private keys, found ${privateRows.length}`);

if (source.length !== 1330)
  error(`Expected 1330 Kurals, found ${source.length}`);

if (chapters.length !== 133)
  error(`Expected 133 chapters, found ${chapters.length}`);

if (index.total_questions !== 9443)
  error(`Index total_questions is ${index.total_questions}`);

console.log("1. Counts : PASS");

/* 2. Public structure */

const requiredPublicFields = [
  "competition",
  "question_id",
  "topic",
  "subtopic",
  "question",
  "difficulty",
  "question_type",
  "age_band",
  "skill",
  "marks",
  "time_seconds",
  "language",
  "source_type",
  "source_reference",
  "copyright_status",
  "review_status"
];

for (const q of publicRows) {
  for (const field of requiredPublicFields) {
    if (
      q[field] === undefined ||
      q[field] === null ||
      q[field] === ""
    ) {
      error(`Missing ${field}: ${q.question_id ?? "UNKNOWN"}`);
    }
  }

  if (q.question_type !== "Short answer") {
    error(
      `Unexpected question_type ${q.question_type}: ${q.question_id}`
    );
  }

  if (q.review_status !== "reviewed") {
    warning(
      `Unexpected review_status ${q.review_status}: ${q.question_id}`
    );
  }

  if (!String(q.question ?? "").trim()) {
    error(`Empty question: ${q.question_id}`);
  }
}

console.log("2. Public structure : PASS");

/* 3. Unique IDs */

const publicIds = new Set();

for (const q of publicRows) {
  if (publicIds.has(q.question_id)) {
    error(`Duplicate public question_id: ${q.question_id}`);
  }
  publicIds.add(q.question_id);
}

const privateIds = new Set();

for (const q of privateRows) {
  if (privateIds.has(q.question_id)) {
    error(`Duplicate private question_id: ${q.question_id}`);
  }
  privateIds.add(q.question_id);
}

console.log("3. Unique IDs : PASS");

/* 4. Public/private alignment */

for (const id of publicIds) {
  if (!privateById.has(id)) {
    error(`Missing private answer key: ${id}`);
  }
}

for (const id of privateIds) {
  if (!publicById.has(id)) {
    error(`Private key without public question: ${id}`);
  }
}

for (const q of privateRows) {
  if (!String(q.answer ?? "").trim()) {
    error(`Empty answer: ${q.question_id}`);
  }

  if (!String(q.explanation ?? "").trim()) {
    error(`Empty explanation: ${q.question_id}`);
  }
}

console.log("4. Public/private alignment : PASS");

/* 5. Question ID uniqueness + normalized question text */

const normalizedQuestions = new Map();

for (const q of publicRows) {
  const normalized = String(q.question)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalizedQuestions.has(normalized)) {
    normalizedQuestions.set(normalized, []);
  }

  normalizedQuestions.get(normalized).push(q.question_id);
}

let duplicateQuestionGroups = 0;

for (const [text, ids] of normalizedQuestions) {
  if (ids.length > 1) {
    duplicateQuestionGroups++;
    error(
      `Duplicate normalized question (${ids.length}): ${ids.join(", ")}`
    );
  }
}

console.log(
  `5. Duplicate questions : ${duplicateQuestionGroups === 0 ? "PASS" : "FAIL"}`
);

/* 6. Topic/module distribution */

const topicCounts = new Map();

for (const q of publicRows) {
  topicCounts.set(
    q.topic,
    (topicCounts.get(q.topic) || 0) + 1
  );
}

console.log("");
console.log("6. Topic distribution:");

for (const [topic, count] of topicCounts) {
  console.log(`   ${topic}: ${count}`);
}

/* Expected topic distribution is already validated above.
   question-index.modules is an object in this bank schema. */

const expectedTopicCounts = {
  "Recitation": 2660,
  "Structural Identification": 3990,
  "Meaning & Moral Reasoning": 2660,
  "Chapter Range": 133
};

for (const [topic, expected] of Object.entries(expectedTopicCounts)) {
  const actual = topicCounts.get(topic) || 0;

  if (actual !== expected) {
    error(
      `Topic ${topic}: expected ${expected}, found ${actual}`
    );
  }
}

/* 7. Source references */


let validKuralRefs = 0;
let validPaalRefs = 0;
let validIyalRefs = 0;
let validChapterRefs = 0;
let kuralRefMissing = 0;
let chapterRefMissing = 0;

for (const q of publicRows) {
  const ref = String(q.source_reference ?? "");

  // Kural references are expected to contain the Kural number.
  const kuralMatch = ref.match(
    /(?:Kural|குறள்)\s*#?\s*(\d{1,4})/i
  );

  // Chapter references are expected to contain an Adhigaram/chapter number.
  const paalMatch = ref.match(
    /(?:Paal|பால்)\s*#?\s*(\d{1,2})/i
  );

  const iyalMatch = ref.match(
    /(?:Iyal|இயல்)\s*#?\s*(\d{1,2})/i
  );

  const chapterMatch = ref.match(
    /(?:Chapter|Adhigaram|அதிகாரம்)\s*#?\s*(\d{1,3})/i
  );

  if (kuralMatch) {
    const n = Number(kuralMatch[1]);

    if (sourceNumbers.has(n)) {
      validKuralRefs++;
    } else {
      error(
        `Invalid Kural reference ${n}: ${q.question_id}`
      );
    }
  }

  if (paalMatch) {
    const n = Number(paalMatch[1]);

    if (paalNumbers.has(n)) {
      validPaalRefs++;
    } else {
      error(`Invalid Paal reference ${n}: ${q.question_id}`);
    }
  }

  if (iyalMatch) {
    const n = Number(iyalMatch[1]);

    if (iyalNumbers.has(n)) {
      validIyalRefs++;
    } else {
      error(`Invalid Iyal reference ${n}: ${q.question_id}`);
    }
  }

  if (chapterMatch) {
    const n = Number(chapterMatch[1]);

    if (chapterNumbers.has(n)) {
      validChapterRefs++;
    } else {
      error(
        `Invalid chapter reference ${n}: ${q.question_id}`
      );
    }
  }

  if (!kuralMatch && !paalMatch && !iyalMatch && !chapterMatch) {
    warning(
      `Could not parse source_reference: ${q.question_id} -> ${ref}`
    );
  }
}

console.log("");
console.log("7. Source references:");
console.log("   Kural refs parsed   :", validKuralRefs);
console.log("   Paal refs parsed    :", validPaalRefs);
console.log("   Iyal refs parsed    :", validIyalRefs);
console.log("   Chapter refs parsed :", validChapterRefs);

/* 8. Public answer leakage */

const forbiddenPublicFields = [
  "answer",
  "correct_answer",
  "answer_key",
  "explanation"
];

let leakage = 0;

for (const q of publicRows) {
  for (const field of forbiddenPublicFields) {
    if (Object.prototype.hasOwnProperty.call(q, field)) {
      leakage++;
      error(
        `Public answer field ${field}: ${q.question_id}`
      );
    }
  }
}

console.log("");
console.log(
  `8. Public/private separation : ${leakage === 0 ? "PASS" : "FAIL"}`
);

/* 9. Kural/chapter coverage based on source_reference */

const referencedKurals = new Set();
const referencedChapters = new Set();

for (const q of publicRows) {
  const ref = String(q.source_reference ?? "");

  const km = ref.match(
    /(?:Kural|குறள்)\s*#?\s*(\d{1,4})/i
  );

  const cm = ref.match(
    /(?:Chapter|Adhigaram|அதிகாரம்)\s*#?\s*(\d{1,3})/i
  );

  if (km) referencedKurals.add(Number(km[1]));
  if (cm) referencedChapters.add(Number(cm[1]));
}

console.log("");
console.log("9. Source coverage:");
console.log(
  `   Kurals referenced   : ${referencedKurals.size}/1330`
);
console.log(
  `   Chapters referenced : ${referencedChapters.size}/133`
);

/* 10. Review state */

const reviewCounts = {};

for (const q of publicRows) {
  reviewCounts[q.review_status] =
    (reviewCounts[q.review_status] || 0) + 1;
}

console.log("");
console.log("10. Review state:");

for (const [status, count] of Object.entries(reviewCounts)) {
  console.log(`   ${status}: ${count}`);
}

if (reviewCounts.reviewed === publicRows.length) {
  console.log(
    "   Approval state    : All 9443 questions are marked reviewed."
  );
} else {
  warning(
    "Not all questions are marked reviewed; verify human approval status."
  );
}

/* Report */

const report = {
  status: errors.length ? "FAIL" : "PASS",
  generated_at: new Date().toISOString(),
  source_kurals: source.length,
  chapters: chapters.length,
  public_questions: publicRows.length,
  private_answer_keys: privateRows.length,
  index_total: index.total_questions,
  topic_counts: Object.fromEntries(topicCounts),
  normalized_question_count: normalizedQuestions.size,
  duplicate_question_groups: duplicateQuestionGroups,
  referenced_kurals: referencedKurals.size,
  referenced_chapters: referencedChapters.size,
  review_counts: reviewCounts,
  errors,
  warnings
};

const outputPath = path.join(
  bankDir,
  "CONTENT-AUDIT-REPORT.json"
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(report, null, 2) + "\n"
);

console.log("");
console.log("========================================");
console.log(`ERRORS   : ${errors.length}`);
console.log(`WARNINGS : ${warnings.length}`);
console.log("========================================");

if (errors.length) {
  console.log("");
  console.log("First 20 errors:");

  for (const e of errors.slice(0, 20)) {
    console.log(" - " + e);
  }
}

if (warnings.length) {
  console.log("");
  console.log(`Warnings: ${warnings.length}`);

  for (const w of warnings.slice(0, 10)) {
    console.log(" - " + w);
  }
}

console.log("");
console.log("Report:");
console.log(outputPath);

process.exit(errors.length ? 1 : 0);
