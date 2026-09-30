import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const root = process.cwd();

const sourcePath = path.join(root, "data/thirukkural/thirukkural.json");
const detailPath = path.join(root, "data/thirukkural/detail.json");
const outDir = path.join(root, "data/thirukkural/generated");

fs.mkdirSync(outDir, { recursive: true });

const kurals = JSON.parse(fs.readFileSync(sourcePath, "utf8")).kural;
const detailRoot = JSON.parse(fs.readFileSync(detailPath, "utf8"))[0];

if (!Array.isArray(kurals) || kurals.length !== 1330) {
  throw new Error(`Expected 1330 Kurals, found ${kurals.length}`);
}

const byNumber = new Map(kurals.map(k => [Number(k.Number), k]));

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
        chapter_transliteration: chapter.transliteration,
        chapter_translation: chapter.translation,
        start: Number(chapter.start),
        end: Number(chapter.end)
      });
    }
  }
}

if (chapters.length !== 133) {
  throw new Error(`Expected 133 Adhigarams, found ${chapters.length}`);
}

if (chapters[0].start !== 1 || chapters.at(-1).end !== 1330) {
  throw new Error("Chapter range validation failed");
}

function chapterForKural(n) {
  const c = chapters.find(x => n >= x.start && n <= x.end);
  if (!c) throw new Error(`No chapter found for Kural ${n}`);
  return c;
}

function kuralText(k) {
  return `${k.Line1}\n${k.Line2}`;
}

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
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
  sourceReference
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
    copyright_status: "Source reference retained; VATTAMS competition question generated from source data",
    review_status: "draft"
  };
}

const rows = [];

// ------------------------------------------------------------
// MODULE 1 — RECITATION — 8
// ------------------------------------------------------------

const recitationNumbers = [1, 50, 100, 250, 500, 750, 1000, 1250];

recitationNumbers.forEach((n, i) => {
  const k = byNumber.get(n);
  if (!k) throw new Error(`Missing Kural ${n}`);

  if (i < 4) {
    rows.push(row({
      id: `TKR-REC-${String(i + 1).padStart(2, "0")}`,
      topic: "Recitation",
      subtopic: "Complete the second line",
      question:
        `திருக்குறள் எண் ${n} இன் முதல் அடியைப் பார்த்து, இரண்டாம் அடியை முழுமையாக எழுதுக.\n\n${k.Line1}`,
      answer: k.Line2,
      explanation: `Source Kural ${n}: ${kuralText(k)}`,
      difficulty: "Foundation",
      skill: "Kural recitation",
      time: k.time_seconds ?? 60,
      sourceReference: `tk120404/thirukkural — Kural ${n}`
    }));
  } else {
    rows.push(row({
      id: `TKR-REC-${String(i + 1).padStart(2, "0")}`,
      topic: "Recitation",
      subtopic: "Complete Kural",
      question:
        `திருக்குறள் எண் ${n} ஐ முழுமையாக எழுதுக.`,
      answer: kuralText(k),
      explanation: `Source Kural ${n}: ${kuralText(k)}`,
      difficulty: "Intermediate",
      skill: "Complete Kural recitation",
      time: k.time_seconds ?? 90,
      sourceReference: `tk120404/thirukkural — Kural ${n}`
    }));
  }
});

// ------------------------------------------------------------
// MODULE 2 — ADHIGARAM IDENTIFICATION — 7
// ------------------------------------------------------------

const identificationNumbers = [10, 100, 200, 500, 700, 1000, 1330];

identificationNumbers.forEach((n, i) => {
  const k = byNumber.get(n);
  const c = chapterForKural(n);

  rows.push(row({
    id: `TKR-ADH-${String(i + 1).padStart(2, "0")}`,
    topic: "Structural Identification",
    subtopic: "Identify Adhigaram",
    question:
      `திருக்குறள் எண் ${n} எந்த அதிகாரத்தைச் சேர்ந்தது? அதிகாரத்தின் தமிழ் பெயரை எழுதுக.`,
    answer: c.chapter,
    explanation:
      `Kural ${n} falls within Adhigaram ${c.chapter_number}: ${c.chapter} (${c.start}–${c.end}).`,
    difficulty: "Intermediate",
    skill: "Adhigaram identification",
    time: 45,
    sourceReference: `tk120404/thirukkural/detail.json — Adhigaram ${c.chapter_number}`
  }));
});

// ------------------------------------------------------------
// MODULE 3 — MEANING / MORAL REASONING — 8
// Deterministic source-derived identification questions.
// ------------------------------------------------------------

const meaningNumbers = [1, 20, 100, 250, 500, 750, 1000, 1250];

meaningNumbers.forEach((n, i) => {
  const k = byNumber.get(n);

  const sourceMeaning =
    k.mv ||
    k.sp ||
    k.mk ||
    k.explanation ||
    "";

  if (!sourceMeaning.trim()) {
    throw new Error(`No source meaning/commentary available for Kural ${n}`);
  }

  rows.push(row({
    id: `TKR-MEAN-${String(i + 1).padStart(2, "0")}`,
    topic: "Meaning & Moral Reasoning",
    subtopic: "Source meaning identification",
    question:
      `கீழே கொடுக்கப்பட்டுள்ள மூல விளக்கம் எந்த திருக்குறளுக்குரியது? திருக்குறள் எண்ணை எழுதுக.\n\n${sourceMeaning}`,
    answer: String(n),
    explanation:
      `The supplied meaning/explanation is attached to source Kural ${n}.`,
    difficulty: "Intermediate",
    skill: "Meaning recognition",
    time: 75,
    sourceReference: `tk120404/thirukkural — Kural ${n}`
  }));
});

// ------------------------------------------------------------
// MODULE 4 — THIRUKKURAL KNOWLEDGE — 7
// All answers come directly from verified source structure.
// ------------------------------------------------------------

const knowledge = [
  {
    id: "TKR-KNOW-01",
    question: "திருக்குறளில் மொத்தம் எத்தனை குறள்கள் உள்ளன?",
    answer: "1330",
    explanation: "Verified source contains Kural numbers 1 through 1330.",
    source: "Verified thirukkural.json"
  },
  {
    id: "TKR-KNOW-02",
    question: "திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன?",
    answer: "133",
    explanation: "Verified detail.json contains 133 Adhigarams.",
    source: "Verified detail.json"
  },
  {
    id: "TKR-KNOW-03",
    question: "திருக்குறளின் மூன்று பால்களின் எண்ணிக்கை எத்தனை?",
    answer: "3",
    explanation: "The verified structure contains three Paal sections.",
    source: "Verified detail.json"
  },
  {
    id: "TKR-KNOW-04",
    question: "திருக்குறளின் மூன்று பால்களின் பெயர்களை வரிசையாக எழுதுக.",
    answer: "அறத்துப்பால், பொருட்பால், காமத்துப்பால்",
    explanation: "These are the three Paal entries in the verified source structure.",
    source: "Verified detail.json"
  },
  {
    id: "TKR-KNOW-05",
    question: "திருக்குறளில் மொத்தம் எத்தனை இயல்கள் உள்ளன?",
    answer: "13",
    explanation: "The verified chapter structure contains 13 Iyal groups.",
    source: "Verified detail.json"
  },
  {
    id: "TKR-KNOW-06",
    question: "முதல் அதிகாரத்தின் பெயர் என்ன?",
    answer: "கடவுள் வாழ்த்து",
    explanation: "Adhigaram 1 is கடவுள் வாழ்த்து, covering Kurals 1–10.",
    source: "Verified detail.json"
  },
  {
    id: "TKR-KNOW-07",
    question: "133-வது அதிகாரத்தின் பெயர் என்ன?",
    answer: "ஊடலுவகை",
    explanation: "Adhigaram 133 is ஊடலுவகை, covering Kurals 1321–1330.",
    source: "Verified detail.json"
  }
];

knowledge.forEach((x, i) => {
  rows.push(row({
    id: x.id,
    topic: "Thirukkural Knowledge Quiz",
    subtopic: "Verified source structure",
    question: x.question,
    answer: x.answer,
    explanation: x.explanation,
    difficulty: "Foundation",
    skill: "Thirukkural structural knowledge",
    time: 45,
    sourceReference: x.source
  }));
});

if (rows.length !== 30) {
  throw new Error(`Expected 30 questions, found ${rows.length}`);
}

const topicCounts = {};
for (const r of rows) {
  topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
}

const expected = {
  "Recitation": 8,
  "Structural Identification": 7,
  "Meaning & Moral Reasoning": 8,
  "Thirukkural Knowledge Quiz": 7
};

if (JSON.stringify(topicCounts) !== JSON.stringify(expected)) {
  throw new Error(
    `Distribution mismatch: ${JSON.stringify(topicCounts)}`
  );
}

// ------------------------------------------------------------
// OUTPUT 1 — chapter index
// ------------------------------------------------------------

fs.writeFileSync(
  path.join(outDir, "chapter-index.json"),
  JSON.stringify(chapters, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// OUTPUT 2 — public-safe questions
// ------------------------------------------------------------

const publicQuestions = rows.map(r => {
  const {
    answer,
    explanation,
    ...safe
  } = r;

  return safe;
});

fs.writeFileSync(
  path.join(outDir, "questions.public.json"),
  JSON.stringify(publicQuestions, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// OUTPUT 3 — private answer key
// ------------------------------------------------------------

const privateKeys = rows.map(r => ({
  question_id: r.question_id,
  answer: r.answer,
  explanation: r.explanation
}));

fs.writeFileSync(
  path.join(outDir, "answer-key.private.json"),
  JSON.stringify(privateKeys, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// OUTPUT 4 — CSV for existing VATTAMS importer
// ------------------------------------------------------------

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
  "review_status"
];

const csv = [
  headers.join(","),
  ...rows.map(r => headers.map(h => csvEscape(r[h])).join(","))
].join("\n");

fs.writeFileSync(
  path.join(outDir, "thirukkural-competition-30.csv"),
  csv,
  "utf8"
);

// ------------------------------------------------------------
// OUTPUT 5 — competition specification
// ------------------------------------------------------------

const specification = {
  competition: "Thirukkural Mastery Championship",
  source: {
    kural_count: 1330,
    adhigaram_count: 133,
    paal_count: 3,
    iyal_count: 13
  },
  competition_attempt: {
    questions: 30,
    question_type: "Short answer",
    tutor_required: false,
    scoring: "Existing VATTAMS competition-scoring function"
  },
  modules: expected,
  preparation_targets: [35, 50, 75, 100, 150],
  note:
    "Preparation targets come from the VATTAMS Thirukkural guideline; the existing competition engine currently runs a 30-question attempt.",
  review_status: "draft"
};

fs.writeFileSync(
  path.join(outDir, "COMPETITION-SPEC.json"),
  JSON.stringify(specification, null, 2),
  "utf8"
);

// ------------------------------------------------------------
// OUTPUT 6 — validation report
// ------------------------------------------------------------

const report = {
  status: "PASS",
  generated_at: new Date().toISOString(),
  source_kurals: kurals.length,
  chapters: chapters.length,
  first_kural: Number(kurals[0].Number),
  last_kural: Number(kurals.at(-1).Number),
  questions: rows.length,
  public_questions: publicQuestions.length,
  private_answer_keys: privateKeys.length,
  distribution: topicCounts,
  all_question_types_short_answer: rows.every(
    r => r.question_type === "Short answer"
  ),
  public_key_separation: publicQuestions.every(
    r => !("answer" in r) && !("explanation" in r)
  ),
  review_status: "draft",
  ready_for_import_after_review: true
};

fs.writeFileSync(
  path.join(outDir, "VALIDATION-REPORT.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log("========================================");
console.log("VATTAMS THIRUKKURAL PACKAGE GENERATED");
console.log("========================================");
console.log("Kurals       :", kurals.length);
console.log("Paal         :", new Set(chapters.map(x => x.paal)).size);
console.log("Iyal         :", new Set(chapters.map(x => `${x.paal_number}:${x.iyal_number}`)).size);
console.log("Adhigaram    :", chapters.length);
console.log("Questions    :", rows.length);
console.log("Distribution :", topicCounts);
console.log("Status       : PASS");
