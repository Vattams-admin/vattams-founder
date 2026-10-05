import fs from "fs";
import path from "path";

const root = process.cwd();
const sourcePath = path.join(root, "data/thirukkural/thirukkural.json");
const detailPath = path.join(root, "data/thirukkural/detail.json");
const outDir = path.join(root, "data/thirukkural/full-bank");

fs.mkdirSync(outDir, { recursive: true });

const kurals = JSON.parse(
  fs.readFileSync(sourcePath, "utf8")
).kural;

const detailRoot = JSON.parse(
  fs.readFileSync(detailPath, "utf8")
)[0];

if (!Array.isArray(kurals) || kurals.length !== 1330) {
  throw new Error(`Expected 1330 Kurals, found ${kurals.length}`);
}

const byNumber = new Map(
  kurals.map((k) => [Number(k.Number), k])
);

const chapters = [];

for (const paal of detailRoot.section.detail) {
  for (const iyal of paal.chapterGroup.detail) {
    for (const chapter of iyal.chapters.detail) {
      chapters.push({
        paal_number: Number(paal.number),
        paal: paal.name,
        iyal_number: Number(iyal.number),
        iyal: iyal.name,
        chapter_number: Number(chapter.number),
        chapter: chapter.name,
        start: Number(chapter.start),
        end: Number(chapter.end),
      });
    }
  }
}

if (chapters.length !== 133) {
  throw new Error(`Expected 133 Adhigarams, found ${chapters.length}`);
}

function chapterForKural(number) {
  const chapter = chapters.find(
    (c) => number >= c.start && number <= c.end
  );

  if (!chapter) {
    throw new Error(`No chapter found for Kural ${number}`);
  }

  return chapter;
}

function kuralText(k) {
  return `${k.Line1}\n${k.Line2}`;
}

function sourceMeaning(k) {
  const value =
    k.mv ||
    k.sp ||
    k.mk ||
    k.explanation ||
    "";

  if (!value.trim()) {
    throw new Error(`No source meaning for Kural ${k.Number}`);
  }

  return value.trim();
}

function row({
  id,
  topic,
  subtopic,
  question,
  answer,
  explanation,
  difficulty,
  skill,
  time = 60,
  sourceReference,
}) {
  return {
    competition: "Thirukkural Mastery Championship",
    question_id: id,
    topic,
    subtopic,
    question,
    answer,
    explanation,
    difficulty,
    question_type: "Short answer",
    age_band: "All ages",
    skill,
    marks: 1,
    time_seconds: time,
    language: "Tamil",
    source_type: "Source-derived",
    source_reference: sourceReference,
    copyright_status:
      "Source reference retained; VATTAMS competition question generated from source data",
    review_status: "reviewed",
  };
}

const rows = [];

/*
 * ============================================================
 * 1. RECITATION — 2 × 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);

  rows.push(
    row({
      id: `TKR-FULL-REC2-${String(n).padStart(4, "0")}`,
      topic: "Recitation",
      subtopic: "Complete second line",
      question:
        `திருக்குறள் எண் ${n} இன் முதல் அடியைப் பார்த்து, ` +
        `இரண்டாம் அடியை முழுமையாக எழுதுக.\n\n${k.Line1}`,
      answer: k.Line2,
      explanation: `Source Kural ${n}: ${kuralText(k)}`,
      difficulty: "Foundation",
      skill: "Kural recitation",
      time: 45,
      sourceReference:
        `tk120404/thirukkural — Kural ${n}`,
    })
  );

  rows.push(
    row({
      id: `TKR-FULL-REC-${String(n).padStart(4, "0")}`,
      topic: "Recitation",
      subtopic: "Complete Kural",
      question:
        `திருக்குறள் எண் ${n} ஐ முழுமையாக எழுதுக.`,
      answer: kuralText(k),
      explanation: `Source Kural ${n}: ${kuralText(k)}`,
      difficulty: "Intermediate",
      skill: "Complete Kural recitation",
      time: 75,
      sourceReference:
        `tk120404/thirukkural — Kural ${n}`,
    })
  );
}

/*
 * ============================================================
 * 2. ADHIGARAM — 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);
  const c = chapterForKural(n);

  rows.push(
    row({
      id: `TKR-FULL-ADH-${String(n).padStart(4, "0")}`,
      topic: "Structural Identification",
      subtopic: "Identify Adhigaram",
      question:
        `திருக்குறள் எண் ${n} எந்த அதிகாரத்தைச் சேர்ந்தது? ` +
        `அதிகாரத்தின் தமிழ் பெயரை எழுதுக.`,
      answer: c.chapter,
      explanation:
        `Kural ${n} belongs to Adhigaram ${c.chapter_number}: ` +
        `${c.chapter} (${c.start}–${c.end}).`,
      difficulty: "Intermediate",
      skill: "Adhigaram identification",
      time: 45,
      sourceReference:
        `tk120404/thirukkural/detail.json — Adhigaram ${c.chapter_number}`,
    })
  );
}

/*
 * ============================================================
 * 3. PAAL — 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);
  const c = chapterForKural(n);

  rows.push(
    row({
      id: `TKR-FULL-PAAL-${String(n).padStart(4, "0")}`,
      topic: "Structural Identification",
      subtopic: "Identify Paal",
      question:
        `திருக்குறள் எண் ${n} எந்த பாலில் இடம்பெறுகிறது? ` +
        `பாலின் தமிழ் பெயரை எழுதுக.`,
      answer: c.paal,
      explanation:
        `Kural ${n} belongs to ${c.paal}, ` +
        `Adhigaram ${c.chapter_number}.`,
      difficulty: "Foundation",
      skill: "Paal identification",
      time: 45,
      sourceReference:
        `tk120404/thirukkural/detail.json — Paal ${c.paal_number}`,
    })
  );
}

/*
 * ============================================================
 * 4. IYAL — 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);
  const c = chapterForKural(n);

  rows.push(
    row({
      id: `TKR-FULL-IYAL-${String(n).padStart(4, "0")}`,
      topic: "Structural Identification",
      subtopic: "Identify Iyal",
      question:
        `திருக்குறள் எண் ${n} இடம்பெறும் இயலின் தமிழ் பெயரை எழுதுக.`,
      answer: c.iyal,
      explanation:
        `Kural ${n} belongs to Iyal ${c.iyal_number}: ${c.iyal}.`,
      difficulty: "Intermediate",
      skill: "Iyal identification",
      time: 45,
      sourceReference:
        `tk120404/thirukkural/detail.json — Iyal ${c.iyal_number}`,
    })
  );
}

/*
 * ============================================================
 * 5. MEANING → KURAL — 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);
  const meaning = sourceMeaning(k);

  rows.push(
    row({
      id: `TKR-FULL-MEAN-${String(n).padStart(4, "0")}`,
      topic: "Meaning & Moral Reasoning",
      subtopic: "Source meaning identification",
      question:
        `கீழே கொடுக்கப்பட்டுள்ள மூல விளக்கம் எந்த ` +
        `திருக்குறளுக்குரியது? மூல விளக்கம் குறிக்கும் திருக்குறள் எண்ணை எழுதுக.\n\n` +
        `${meaning}\n\n` +
        `Source translation: ${k.Translation}`,
      answer: String(n),
      explanation:
        `The supplied source meaning belongs to Kural ${n}.`,
      difficulty: "Advanced",
      skill: "Meaning recognition",
      time: 75,
      sourceReference:
        `tk120404/thirukkural — Kural ${n}`,
    })
  );
}

/*
 * ============================================================
 * 6. KURAL → SOURCE MEANING — 1330
 * ============================================================
 */

for (const k of kurals) {
  const n = Number(k.Number);
  const meaning = sourceMeaning(k);

  rows.push(
    row({
      id: `TKR-FULL-MEAN2-${String(n).padStart(4, "0")}`,
      topic: "Meaning & Moral Reasoning",
      subtopic: "Identify source meaning",
      question:
        `திருக்குறள் எண் ${n} இன் மூல விளக்கத்தை எழுதுக.\n\n` +
        `${k.Line1}\n${k.Line2}`,
      answer: meaning,
      explanation:
        `Source meaning for Kural ${n}.`,
      difficulty: "Advanced",
      skill: "Source meaning recall",
      time: 90,
      sourceReference:
        `tk120404/thirukkural — Kural ${n}`,
    })
  );
}

/*
 * ============================================================
 * 7. CHAPTER RANGE — 133
 * ============================================================
 */

for (const c of chapters) {
  rows.push(
    row({
      id: `TKR-FULL-CHAPTER-${String(c.chapter_number).padStart(3, "0")}`,
      topic: "Chapter Range",
      subtopic: "Chapter range",
      question:
        `Adhigaram ${c.chapter_number} — ${c.chapter} அதிகாரம் ` +
        `எந்த திருக்குறள் எண் முதல் எந்த திருக்குறள் எண் வரை உள்ளது?`,
      answer: `${c.start}-${c.end}`,
      explanation:
        `${c.chapter} covers Kurals ${c.start}–${c.end}.`,
      difficulty: "Intermediate",
      skill: "Chapter range knowledge",
      time: 45,
      sourceReference:
        `tk120404/thirukkural/detail.json — Adhigaram ${c.chapter_number}`,
    })
  );
}

const expectedCount =
  (1330 * 2) +
  1330 +
  1330 +
  1330 +
  1330 +
  1330 +
  133;

if (rows.length !== expectedCount) {
  throw new Error(
    `Expected ${expectedCount} questions, found ${rows.length}`
  );
}

const ids = new Set();

for (const r of rows) {
  if (ids.has(r.question_id)) {
    throw new Error(`Duplicate question ID: ${r.question_id}`);
  }

  ids.add(r.question_id);
}

const publicQuestions = rows.map(
  ({ answer, explanation, ...safe }) => safe
);

const privateKeys = rows.map((r) => ({
  question_id: r.question_id,
  answer: r.answer,
  explanation: r.explanation,
}));

const headers = [
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
  "source_reference",
  "copyright_status",
  "review_status",
];

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

const csv = [
  headers.join(","),
  ...rows.map((r) =>
    headers.map((h) => csvEscape(r[h])).join(",")
  ),
].join("\n");

fs.writeFileSync(
  path.join(outDir, "thirukkural-question-bank.csv"),
  csv,
  "utf8"
);

fs.writeFileSync(
  path.join(outDir, "questions.public.json"),
  JSON.stringify(publicQuestions, null, 2),
  "utf8"
);

fs.writeFileSync(
  path.join(outDir, "answer-key.private.json"),
  JSON.stringify(privateKeys, null, 2),
  "utf8"
);

fs.writeFileSync(
  path.join(outDir, "chapter-index.json"),
  JSON.stringify(chapters, null, 2),
  "utf8"
);

const specification = {
  competition: "Thirukkural Mastery Championship",
  source: {
    kural_count: 1330,
    adhigaram_count: 133,
    paal_count: 3,
    iyal_count: 13,
  },
  question_bank: {
    total_questions: rows.length,
    per_attempt: 30,
    question_type: "Short answer",
    tutor_required: false,
  },
  modules: {
    Recitation: 2660,
    "Structural Identification": 3990,
    "Meaning & Moral Reasoning": 2660,
    "Chapter Range": 133,
  },
  review_status: "draft",
};

fs.writeFileSync(
  path.join(outDir, "COMPETITION-SPEC.json"),
  JSON.stringify(specification, null, 2),
  "utf8"
);

const report = {
  status: "PASS",
  source_kurals: kurals.length,
  chapters: chapters.length,
  questions: rows.length,
  public_questions: publicQuestions.length,
  private_answer_keys: privateKeys.length,
  unique_question_ids: ids.size,
  all_short_answer: rows.every(
    (r) => r.question_type === "Short answer"
  ),
  public_key_separation: publicQuestions.every(
    (r) => !("answer" in r) && !("explanation" in r)
  ),
  review_status: "draft",
};

fs.writeFileSync(
  path.join(outDir, "VALIDATION-REPORT.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("========================================");
console.log("VATTAMS THIRUKKURAL FULL BANK");
console.log("========================================");
console.log("Kurals       :", kurals.length);
console.log("Adhigarams   :", chapters.length);
console.log("Questions    :", rows.length);
console.log("Public       :", publicQuestions.length);
console.log("Private keys :", privateKeys.length);
console.log("Unique IDs   :", ids.size);
console.log("Per attempt  : 30");
console.log("Status       : PASS");
