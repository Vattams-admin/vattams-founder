import fs from "node:fs";

const COURSE_ID = "DNWt3cPE4ZSJG90CTC1e";

const PAPERS = {
  up_to_8: {
    prefix: "TKR-U8-",
    ids: Array.from({ length: 30 }, (_, i) => `TKR-U8-${String(i + 1).padStart(2, "0")}`),
    blueprint: [["Complete second line", 15], ["Identify Paal", 15]],
  },
  age_9_12: {
    prefix: "TKR-A9-12-",
    ids: Array.from({ length: 30 }, (_, i) => `TKR-A9-12-${String(i + 1).padStart(2, "0")}`),
    blueprint: [["Complete second line", 5], ["Identify Paal", 5], ["Complete Kural", 8], ["Identify Adhigaram", 3], ["Identify Iyal", 3], ["Chapter range", 6]],
  },
  age_13_15: {
    prefix: "TKR-A13-15-",
    ids: Array.from({ length: 30 }, (_, i) => `TKR-A13-15-${String(i + 1).padStart(2, "0")}`),
    blueprint: [["Complete Kural", 5], ["Identify Adhigaram", 5], ["Identify Iyal", 4], ["Chapter range", 2], ["Source meaning identification", 7], ["Identify source meaning", 7]],
  },
  age_16_plus: {
    prefix: "",
    ids: [
      ...Array.from({ length: 8 }, (_, i) => `TKR-REC-${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 7 }, (_, i) => `TKR-ADH-${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 8 }, (_, i) => `TKR-MEAN-${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 7 }, (_, i) => `TKR-KNOW-${String(i + 1).padStart(2, "0")}`),
    ],
  },
};

const publicQuestions = JSON.parse(fs.readFileSync("data/thirukkural/full-bank/questions.public.json", "utf8"));
const privateKeys = JSON.parse(fs.readFileSync("data/thirukkural/full-bank/answer-key.private.json", "utf8"));
const agePools = JSON.parse(fs.readFileSync("data/thirukkural/full-bank/objective/age-pools.json", "utf8"));
const keyById = new Map(privateKeys.map((k) => [k.question_id, k]));
const publicById = new Map(publicQuestions.map((q) => [q.question_id, q]));

function unique(values) {
  return [...new Set(values.filter(Boolean).map((x) => String(x).trim()))];
}

function makeOptions(correct, pool) {
  const answer = String(correct).trim();
  const distractors = unique(pool).filter((x) => x !== answer).slice(0, 3);
  if (distractors.length < 3) throw new Error(`Not enough distractors for answer: ${answer}`);
  return [answer, ...distractors];
}

function sourceQuestion(id) {
  const q = publicById.get(id);
  const key = keyById.get(id);
  if (!q || !key) throw new Error(`Missing reviewed source question/key: ${id}`);
  if (q.review_status !== "reviewed") throw new Error(`${id}: source question is not reviewed`);
  if (!Array.isArray(q.options) || q.options.length !== 4) throw new Error(`${id}: invalid source options`);
  return { q, key };
}

function buildAgeBand(band, spec) {
  const selected = [];
  for (const [topic, count] of spec.blueprint) {
    const pool = agePools?.[band]?.[topic];
    if (!Array.isArray(pool) || pool.length < count) throw new Error(`${band}/${topic}: insufficient reviewed pool`);
    selected.push(...pool.slice(0, count));
  }
  if (selected.length !== 30 || new Set(selected).size !== 30) throw new Error(`${band}: paper must resolve to 30 unique questions`);

  return selected.map((sourceId, index) => {
    const { q, key } = sourceQuestion(sourceId);
    const id = spec.ids[index];
    return {
      question_id: id,
      course_id: COURSE_ID,
      competition: "Thirukkural Mastery Championship",
      age_band: band,
      topic: q.topic || "",
      subtopic: q.subtopic || "",
      question: q.question,
      question_type: "Multiple Choice",
      options: q.options.map(String),
      answer: String(key.answer).trim(),
      explanation: key.explanation || q.explanation || "",
      marks: 1,
      time_seconds: Number(q.time_seconds) || 60,
      language: q.language || "Tamil",
      review_status: "reviewed",
      source_question_id: sourceId,
    };
  });
}

function build16Plus() {
  const legacyIds = PAPERS.age_16_plus.ids;
  const legacy = [];
  const kuralNumbers = [1,50,100,250,500,750,1000,1250];
  for (let i=0;i<8;i++) legacy.push([legacyIds[i], `TKR-FULL-REC2-${String(kuralNumbers[i]).padStart(4,"0")}`]);
  const adhNumbers=[10,100,200,500,700,1000,1330];
  for (let i=0;i<7;i++) legacy.push([legacyIds[8+i], `TKR-FULL-ADH-${String(adhNumbers[i]).padStart(4,"0")}`]);
  const meanNumbers=[1,20,100,250,500,750,1000,1250];
  for (let i=0;i<8;i++) legacy.push([legacyIds[15+i], `TKR-FULL-MEAN-${String(meanNumbers[i]).padStart(4,"0")}`]);

  const knowledge = [
    ["TKR-KNOW-01","திருக்குறளில் மொத்தம் எத்தனை குறள்கள் உள்ளன?","1330"],
    ["TKR-KNOW-02","திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன?","133"],
    ["TKR-KNOW-03","திருக்குறளில் மொத்தம் எத்தனை பால் பிரிவுகள் உள்ளன?","3"],
    ["TKR-KNOW-04","திருக்குறளின் மூன்று பால் பிரிவுகள் சரியான வரிசையில் எவை?","அறத்துப்பால், பொருட்பால், காமத்துப்பால்"],
    ["TKR-KNOW-05","திருக்குறளில் மொத்தம் எத்தனை இயல் பிரிவுகள் உள்ளன?","13"],
    ["TKR-KNOW-06","திருக்குறளின் முதல் அதிகாரம் எது?","கடவுள் வாழ்த்து"],
    ["TKR-KNOW-07","திருக்குறளின் 133-வது அதிகாரம் எது?","ஊடலுவகை"],
  ];

  const out=[];
  for (const [id, sourceId] of legacy) {
    const {q,key}=sourceQuestion(sourceId);
    out.push({...q, question_id:id, course_id:COURSE_ID, competition:"Thirukkural Mastery Championship", age_band:"age_16_plus", question:q.question, question_type:"Multiple Choice", options:q.options.map(String), answer:String(key.answer).trim(), explanation:key.explanation||q.explanation||"", marks:1, time_seconds:Number(q.time_seconds)||60, language:q.language||"Tamil", review_status:"reviewed"});
  }
  const adhNames=unique(publicQuestions.filter(q=>q.topic==="Structural Identification").map(q=>keyById.get(q.question_id)?.answer));
  for (const [id,question,answer] of knowledge) {
    let options;
    if (id==="TKR-KNOW-04") options=[answer,"அறத்துப்பால், காமத்துப்பால், பொருட்பால்","பொருட்பால், அறத்துப்பால், காமத்துப்பால்","காமத்துப்பால், பொருட்பால், அறத்துப்பால்"];
    else if (/^TKR-KNOW-0[1235]$/.test(id)) { const n=Number(answer); options=[answer,String(n+1),String(n+2),String(n+3)]; }
    else options=makeOptions(answer,adhNames);
    out.push({question_id:id,course_id:COURSE_ID,competition:"Thirukkural Mastery Championship",age_band:"age_16_plus",topic:"Knowledge",subtopic:"",question,question_type:"Multiple Choice",options,answer,explanation:"Approved Thirukkural knowledge item.",marks:1,time_seconds:60,language:"Tamil",review_status:"reviewed"});
  }
  return out;
}

const output = [
  ...buildAgeBand("up_to_8", PAPERS.up_to_8),
  ...buildAgeBand("age_9_12", PAPERS.age_9_12),
  ...buildAgeBand("age_13_15", PAPERS.age_13_15),
  ...build16Plus(),
];

if (output.length !== 120 || new Set(output.map(q=>q.question_id)).size !== 120) throw new Error("Official production set must contain 120 unique questions");
for (const q of output) {
  if (!q.question?.trim() || q.options.length!==4 || new Set(q.options).size!==4 || !q.options.includes(q.answer)) throw new Error(`${q.question_id}: invalid official question`);
}
const outPath="data/thirukkural/full-bank/objective/official-120.objective.json";
fs.mkdirSync("data/thirukkural/full-bank/objective",{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(output,null,2),"utf8");
console.log("OFFICIAL OBJECTIVE QUESTIONS:",output.length);
console.log("PAPERS: up_to_8=30, age_9_12=30, age_13_15=30, age_16_plus=30");
console.log("OUTPUT:",outPath);
console.log("VALIDATION: PASS");
