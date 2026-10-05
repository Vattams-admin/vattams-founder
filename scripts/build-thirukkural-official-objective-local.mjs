import fs from "node:fs";

const COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";
const ROOT = "data/thirukkural/full-bank/objective";
const publicQuestions = JSON.parse(fs.readFileSync(`${ROOT}/questions.objective.public.json`, "utf8"));
const privateKeys = JSON.parse(fs.readFileSync(`${ROOT}/answer-key.objective.private.json`, "utf8"));
const agePools = JSON.parse(fs.readFileSync(`${ROOT}/age-pools.json`, "utf8"));

const publicById = new Map(publicQuestions.map((q) => [q.question_id, q]));
const keyById = new Map(privateKeys.map((q) => [q.question_id, q]));

function sourceQuestion(id) {
  const q = publicById.get(id);
  const k = keyById.get(id);
  if (!q || !k) throw new Error(`Missing objective source question/key: ${id}`);
  if (q.review_status !== "reviewed") throw new Error(`${id}: source question is not reviewed`);
  if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options.map(String)).size !== 4) {
    throw new Error(`${id}: invalid objective options`);
  }
  return { q, k };
}

const PAPER_BLUEPRINTS = {
  up_to_8: [
    ["Complete second line", 15], ["Identify Paal", 15],
  ],
  age_9_12: [
    ["Complete second line", 5], ["Identify Paal", 5], ["Complete Kural", 8],
    ["Identify Adhigaram", 3], ["Identify Iyal", 3], ["Chapter range", 6],
  ],
  age_13_15: [
    ["Complete Kural", 5], ["Identify Adhigaram", 5], ["Identify Iyal", 4],
    ["Chapter range", 2], ["Source meaning identification", 7], ["Identify source meaning", 7],
  ],
};

function chooseFromBand(band, blueprint) {
  const selected = [];
  for (const [subtopic, count] of blueprint) {
    const pool = agePools?.[band]?.[subtopic];
    if (!Array.isArray(pool) || pool.length < count) {
      throw new Error(`${band}/${subtopic}: insufficient source pool`);
    }
    selected.push(...pool.slice(0, count));
  }
  if (selected.length !== 30 || new Set(selected).size !== 30) {
    throw new Error(`${band}: official paper must contain 30 unique questions`);
  }
  return selected.map((sourceId, index) => {
    const { q, k } = sourceQuestion(sourceId);
    return {
      question_id: ["TKR-U8-","TKR-A9-12-","TKR-A13-15-"][["up_to_8","age_9_12","age_13_15"].indexOf(band)] + String(index + 1).padStart(2,"0"),
      course_id: COURSE_ID,
      competition: "Thirukkural Mastery Championship",
      age_band: band,
      topic: q.topic || "",
      subtopic: q.subtopic || "",
      question: q.question,
      question_type: "Multiple Choice",
      options: q.options.map(String),
      answer: String(k.answer).trim(),
      explanation: k.explanation || q.explanation || "",
      marks: 1,
      time_seconds: Number(q.time_seconds) || 60,
      language: q.language || "Tamil",
      review_status: "reviewed",
      source_question_id: sourceId,
    };
  });
}

const official16Source = [
  "TKR-FULL-REC2-0001","TKR-FULL-REC2-0050","TKR-FULL-REC2-0100","TKR-FULL-REC2-0250",
  "TKR-FULL-REC2-0500","TKR-FULL-REC2-0750","TKR-FULL-REC2-1000","TKR-FULL-REC2-1250",
  "TKR-FULL-ADH-0010","TKR-FULL-ADH-0100","TKR-FULL-ADH-0200","TKR-FULL-ADH-0500",
  "TKR-FULL-ADH-0700","TKR-FULL-ADH-1000","TKR-FULL-ADH-1330",
  "TKR-FULL-MEAN-0001","TKR-FULL-MEAN-0020","TKR-FULL-MEAN-0100","TKR-FULL-MEAN-0250",
  "TKR-FULL-MEAN-0500","TKR-FULL-MEAN-0750","TKR-FULL-MEAN-1000","TKR-FULL-MEAN-1250",
];

const knowledge = [
  ["1330","திருக்குறளில் மொத்தம் எத்தனை குறள்கள் உள்ளன?"],
  ["133","திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன?"],
  ["3","திருக்குறளில் மொத்தம் எத்தனை பால் பிரிவுகள் உள்ளன?"],
  ["அறத்துப்பால், பொருட்பால், காமத்துப்பால்","திருக்குறளின் மூன்று பால் பிரிவுகள் சரியான வரிசையில் எவை?"],
  ["13","திருக்குறளில் மொத்தம் எத்தனை இயல் பிரிவுகள் உள்ளன?"],
  ["கடவுள் வாழ்த்து","திருக்குறளின் முதல் அதிகாரம் எது?"],
  ["ஊடலுவகை","திருக்குறளின் 133-வது அதிகாரம் எது?"],
];

function knowledgeOptions(answer, index) {
  if (index === 3) return [answer,"அறத்துப்பால், காமத்துப்பால், பொருட்பால்","பொருட்பால், அறத்துப்பால், காமத்துப்பால்","காமத்துப்பால், பொருட்பால், அறத்துப்பால்"];
  if (/^\d+$/.test(answer)) {
    const n=Number(answer);
    return [answer,String(n+1),String(Math.max(1,n-1)),String(n+2)];
  }
  const structural = [...new Set(publicQuestions.filter(q=>q.topic==="Structural Identification").map(q=>keyById.get(q.question_id)?.answer).filter(Boolean).map(String))].filter(x=>x!==answer);
  if (structural.length<3) throw new Error(`Not enough structural distractors for ${answer}`);
  return [answer,...structural.slice(0,3)];
}

function makeLegacy16() {
  const out = official16Source.map((sourceId,index) => {
    const {q,k}=sourceQuestion(sourceId);
    return {
      question_id: [...Array.from({length:8},(_,i)=>`TKR-REC-${String(i+1).padStart(2,"0")}`),
        ...Array.from({length:7},(_,i)=>`TKR-ADH-${String(i+1).padStart(2,"0")}`),
        ...Array.from({length:8},(_,i)=>`TKR-MEAN-${String(i+1).padStart(2,"0")}`)][index],
      course_id: COURSE_ID, competition:"Thirukkural Mastery Championship", age_band:"age_16_plus",
      topic:q.topic||"", subtopic:q.subtopic||"", question:q.question, question_type:"Multiple Choice",
      options:q.options.map(String), answer:String(k.answer).trim(), explanation:k.explanation||q.explanation||"",
      marks:1,time_seconds:Number(q.time_seconds)||60,language:q.language||"Tamil",review_status:"reviewed",source_question_id:sourceId,
    };
  });
  knowledge.forEach(([answer,question],i)=>{
    out.push({
      question_id:`TKR-KNOW-${String(i+1).padStart(2,"0")}`,course_id:COURSE_ID,
      competition:"Thirukkural Mastery Championship",age_band:"age_16_plus",topic:"Knowledge",
      subtopic:"Core Thirukkural facts",question,question_type:"Multiple Choice",
      options:knowledgeOptions(answer,i),answer,explanation:"Approved Thirukkural production knowledge item.",
      marks:1,time_seconds:60,language:"Tamil",review_status:"reviewed",
    });
  });
  return out;
}

const output = [
  ...chooseFromBand("up_to_8", PAPER_BLUEPRINTS.up_to_8),
  ...chooseFromBand("age_9_12", PAPER_BLUEPRINTS.age_9_12),
  ...chooseFromBand("age_13_15", PAPER_BLUEPRINTS.age_13_15),
  ...makeLegacy16(),
];

if (output.length !== 120 || new Set(output.map(q=>q.question_id)).size !== 120) throw new Error("Official production set must contain 120 unique questions");
for (const q of output) {
  if (!q.question?.trim() || q.options.length!==4 || new Set(q.options).size!==4 || !q.options.includes(q.answer)) throw new Error(`${q.question_id}: invalid official question`);
}
fs.mkdirSync(ROOT,{recursive:true});
fs.writeFileSync(`${ROOT}/official-120.objective.json`,JSON.stringify(output,null,2),"utf8");
console.log("OFFICIAL OBJECTIVE QUESTIONS:",output.length);
console.log("VALIDATION: PASS");
