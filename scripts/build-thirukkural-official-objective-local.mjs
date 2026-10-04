import fs from "node:fs";

const OFFICIAL = {
  "TKR-REC-01": {
    answer: "பகவன் முதற்றே உலகு.",
    explanation: "Source Kural 1."
  },
  "TKR-REC-02": {
    answer: "தெய்வத்துள் வைக்கப் படும்.",
    explanation: "Source Kural 50."
  },
  "TKR-REC-03": {
    answer: "கனிஇருப்பக் காய்கவர்ந் தற்று.",
    explanation: "Source Kural 100."
  },
  "TKR-REC-04": {
    answer: "மெலியார்மேல் செல்லு மிடத்து.",
    explanation: "Source Kural 250."
  },
  "TKR-REC-05": {
    answer: "காலாழ் களரில் நரியடும் கண்ணஞ்சா\nவேலாள் முகத்த களிறு.",
    explanation: "Source Kural 500."
  },
  "TKR-REC-06": {
    answer: "எனைமாட்சித் தாகியக் கண்ணும் வினைமாட்சி\nஇல்லார்கண் இல்லது அரண்.",
    explanation: "Source Kural 750."
  },
  "TKR-REC-07": {
    answer: "பண்பிலான் பெற்ற பெருஞ்செல்வம் நன்பால்\nகலந்தீமை யால்திரிந் தற்று.",
    explanation: "Source Kural 1000."
  },
  "TKR-REC-08": {
    answer: "துன்னாத் துறந்தாரை நெஞ்சத்து உடையேமா\nஇன்னும் இழத்தும் கவின்.",
    explanation: "Source Kural 1250."
  },

  "TKR-ADH-01": {
    answer: "கடவுள் வாழ்த்து",
    explanation: "Kural 10 belongs to the first Adhigaram."
  },
  "TKR-ADH-02": {
    answer: "இனியவை கூறல்",
    explanation: "Kural 100 belongs to the Adhigaram இனியவை கூறல்."
  },
  "TKR-ADH-03": {
    answer: "பயனில சொல்லாமை",
    explanation: "Kural 200 belongs to the Adhigaram பயனில சொல்லாமை."
  },
  "TKR-ADH-04": {
    answer: "இடனறிதல்",
    explanation: "Kural 500 belongs to the Adhigaram இடனறிதல்."
  },
  "TKR-ADH-05": {
    answer: "மன்னரைச் சேர்ந்து ஒழுகல்",
    explanation: "Kural 700 belongs to the Adhigaram மன்னரைச் சேர்ந்து ஒழுகல்."
  },
  "TKR-ADH-06": {
    answer: "பண்புடைமை",
    explanation: "Kural 1000 belongs to the Adhigaram பண்புடைமை."
  },
  "TKR-ADH-07": {
    answer: "ஊடலுவகை",
    explanation: "Kural 1330 belongs to the final Adhigaram."
  },

  "TKR-MEAN-01": {
    answer: "1",
    explanation: "Meaning question for Kural 1."
  },
  "TKR-MEAN-02": {
    answer: "20",
    explanation: "Meaning question for Kural 20."
  },
  "TKR-MEAN-03": {
    answer: "100",
    explanation: "Meaning question for Kural 100."
  },
  "TKR-MEAN-04": {
    answer: "250",
    explanation: "Meaning question for Kural 250."
  },
  "TKR-MEAN-05": {
    answer: "500",
    explanation: "Meaning question for Kural 500."
  },
  "TKR-MEAN-06": {
    answer: "750",
    explanation: "Meaning question for Kural 750."
  },
  "TKR-MEAN-07": {
    answer: "1000",
    explanation: "Meaning question for Kural 1000."
  },
  "TKR-MEAN-08": {
    answer: "1250",
    explanation: "Meaning question for Kural 1250."
  },

  "TKR-KNOW-01": {
    answer: "1330",
    explanation: "Total number of Kurals."
  },
  "TKR-KNOW-02": {
    answer: "133",
    explanation: "Total number of Adhigarams."
  },
  "TKR-KNOW-03": {
    answer: "3",
    explanation: "Total number of Paal sections."
  },
  "TKR-KNOW-04": {
    answer: "அறத்துப்பால், பொருட்பால், காமத்துப்பால்",
    explanation: "The three Paal sections in order."
  },
  "TKR-KNOW-05": {
    answer: "13",
    explanation: "Total number of Iyal groups."
  },
  "TKR-KNOW-06": {
    answer: "கடவுள் வாழ்த்து",
    explanation: "First Adhigaram."
  },
  "TKR-KNOW-07": {
    answer: "ஊடலுவகை",
    explanation: "133rd Adhigaram."
  }
};

const IDS = Object.keys(OFFICIAL);

if (IDS.length !== 30) {
  throw new Error(`Expected 30 official IDs, got ${IDS.length}`);
}

const publicQuestions = JSON.parse(
  fs.readFileSync(
    "data/thirukkural/full-bank/questions.public.json",
    "utf8"
  )
);

const privateKeys = JSON.parse(
  fs.readFileSync(
    "data/thirukkural/full-bank/answer-key.private.json",
    "utf8"
  )
);

const keyById = new Map(
  privateKeys.map((k) => [k.question_id, k])
);

const publicById = new Map(
  publicQuestions.map((q) => [q.question_id, q])
);

const OFFICIAL_KURAL_NUMBERS = [
  1, 50, 100, 250, 500, 750, 1000, 1250,
];

function officialQuestionText(id) {
  if (id.startsWith("TKR-REC-")) {
    const index = Number(id.slice("TKR-REC-")) - 1;
    const n = OFFICIAL_KURAL_NUMBERS[index];
    const source = publicById.get(
      `TKR-FULL-REC2-${String(n).padStart(4, "0")}`
    );
    return source?.question || `திருக்குறள் எண் ${n} இன் இரண்டாம் அடியைத் தேர்ந்தெடுக்கவும்.`;
  }

  if (id.startsWith("TKR-ADH-")) {
    const numbers = [10, 100, 200, 500, 700, 1000, 1330];
    const n = numbers[Number(id.slice("TKR-ADH-")) - 1];
    const source = publicById.get(
      `TKR-FULL-ADH-${String(n).padStart(4, "0")}`
    );
    return source?.question || `திருக்குறள் எண் ${n} எந்த அதிகாரத்தைச் சேர்ந்தது?`;
  }

  if (id.startsWith("TKR-MEAN-")) {
    const numbers = [1, 20, 100, 250, 500, 750, 1000, 1250];
    const n = numbers[Number(id.slice("TKR-MEAN-")) - 1];
    const source = publicById.get(
      `TKR-FULL-MEAN-${String(n).padStart(4, "0")}`
    );
    return source?.question || `கொடுக்கப்பட்டுள்ள மூல விளக்கம் எந்த திருக்குறளுக்குரியது? (குறள் ${n})`;
  }

  const knowledgeQuestions = {
    "TKR-KNOW-01": "திருக்குறளில் மொத்தம் எத்தனை குறள்கள் உள்ளன?",
    "TKR-KNOW-02": "திருக்குறளில் மொத்தம் எத்தனை அதிகாரங்கள் உள்ளன?",
    "TKR-KNOW-03": "திருக்குறளில் மொத்தம் எத்தனை பால் பிரிவுகள் உள்ளன?",
    "TKR-KNOW-04": "திருக்குறளின் மூன்று பால் பிரிவுகள் சரியான வரிசையில் எவை?",
    "TKR-KNOW-05": "திருக்குறளில் மொத்தம் எத்தனை இயல் பிரிவுகள் உள்ளன?",
    "TKR-KNOW-06": "திருக்குறளின் முதல் அதிகாரம் எது?",
    "TKR-KNOW-07": "திருக்குறளின் 133-வது அதிகாரம் எது?",
  };

  return knowledgeQuestions[id] || "";
}

function unique(values) {
  return [...new Set(
    values
      .filter(Boolean)
      .map((x) => String(x).trim())
  )];
}

function choose(correct, pool) {
  const cleanCorrect = String(correct).trim();

  const candidates = unique(pool)
    .filter((x) => x !== cleanCorrect);

  if (candidates.length < 3) {
    throw new Error(
      `Not enough distractors for answer: ${cleanCorrect}`
    );
  }

  return [
    cleanCorrect,
    ...candidates.slice(0, 3)
  ];
}

const rec2Pool = unique(
  publicQuestions
    .filter((q) =>
      q.question_id?.startsWith("TKR-FULL-REC2-")
    )
    .map((q) => keyById.get(q.question_id)?.answer)
);

const recFullPool = unique(
  publicQuestions
    .filter((q) =>
      q.question_id?.startsWith("TKR-FULL-REC-")
    )
    .map((q) => keyById.get(q.question_id)?.answer)
);

const adhNames = unique(
  publicQuestions
    .filter((q) =>
      q.topic === "Structural Identification"
    )
    .map((q) => keyById.get(q.question_id)?.answer)
);

function makeOptions(id, answer) {
  const correct = String(answer).trim();

  if (id.startsWith("TKR-REC-")) {
    const number = Number(
      id.slice("TKR-REC-".length)
    );

    return number <= 4
      ? choose(correct, rec2Pool)
      : choose(correct, recFullPool);
  }

  if (id.startsWith("TKR-ADH-")) {
    return choose(correct, adhNames);
  }

  if (id.startsWith("TKR-MEAN-")) {
    const n = Number(correct);

    return [
      String(n),
      String(n + 1),
      String(n + 2),
      String(n + 3)
    ];
  }

  if (id === "TKR-KNOW-04") {
    const permutations = [
      "அறத்துப்பால், பொருட்பால், காமத்துப்பால்",
      "அறத்துப்பால், காமத்துப்பால், பொருட்பால்",
      "பொருட்பால், அறத்துப்பால், காமத்துப்பால்",
      "பொருட்பால், காமத்துப்பால், அறத்துப்பால்",
      "காமத்துப்பால், அறத்துப்பால், பொருட்பால்",
      "காமத்துப்பால், பொருட்பால், அறத்துப்பால்"
    ];

    return [
      correct,
      ...permutations
        .filter((x) => x !== correct)
        .slice(0, 3)
    ];
  }

  if (
    id === "TKR-KNOW-01" ||
    id === "TKR-KNOW-02" ||
    id === "TKR-KNOW-03" ||
    id === "TKR-KNOW-05"
  ) {
    const n = Number(correct);

    return [
      String(n),
      String(n + 1),
      String(n + 2),
      String(n + 3)
    ];
  }

  if (
    id === "TKR-KNOW-06" ||
    id === "TKR-KNOW-07"
  ) {
    return choose(correct, adhNames);
  }

  throw new Error(`Unsupported official ID: ${id}`);
}

const output = [];

for (const id of IDS) {
  const official = OFFICIAL[id];

  const options = makeOptions(
    id,
    official.answer
  );

  if (options.length !== 4) {
    throw new Error(
      `${id}: expected 4 options, got ${options.length}`
    );
  }

  if (new Set(options).size !== 4) {
    throw new Error(
      `${id}: duplicate options`
    );
  }

  if (!options.includes(official.answer)) {
    throw new Error(
      `${id}: correct answer missing`
    );
  }

  const question = officialQuestionText(id);

  if (!question.trim()) {
    throw new Error(`${id}: official question text is missing`);
  }

  output.push({
    question_id: id,
    course_id: "DNWt3cPE4ZSJG90CTC1e",
    competition: "Thirukkural Mastery Championship",
    question,
    question_type: "Multiple Choice",
    options,
    answer: official.answer,
    explanation: official.explanation,
    marks: 1,
    time_seconds: 60,
    language: "Tamil",
    review_status: "reviewed"
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

console.log(
  "OFFICIAL OBJECTIVE QUESTIONS:",
  output.length
);
console.log("OUTPUT:", outPath);
console.log("FIRESTORE READS: 0");
console.log("VALIDATION: PASS");
