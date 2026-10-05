import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bands = ["up_to_8", "age_9_12", "age_13_15", "age_16_plus"];
const slugs = [
  "mathematics-challenge","science-challenge","english-challenge","computer-challenge",
  "gk-challenge","reasoning-challenge","india-gk-championship","national-quiz-championship",
  "ai-technology-challenge","international-knowledge-challenge","national-mathematics-championship",
  "national-science-championship","national-english-championship","national-aptitude-championship",
  "national-coding-challenge","national-ai-challenge","mega-inter-school-championship",
  "indian-classical-literature-wisdom-championship","indian-language-literature-masters-series",
  "thirukkural-mastery-championship","fun-with-maths-challenge","azhagu-tamil-challenge",
  "handwriting-excellence-challenge","spoken-hindi-challenge",
];
const requestedSlug = process.argv.includes("--slug") ? process.argv[process.argv.indexOf("--slug") + 1] : "";
const targetSlugs = requestedSlug ? slugs.filter((slug) => slug === requestedSlug) : slugs;
if (requestedSlug && targetSlugs.length !== 1) throw new Error(`Unknown competition slug: ${requestedSlug}`);

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + "\n");

function questionId(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.id ?? value.question_id ?? "").trim();
  }
  return "";
}

function uniqueIds(values) {
  return [...new Set(values.map(questionId).filter(Boolean))];
}

function makeBlueprint(pools) {
  const result = {};
  for (const band of bands) {
    const topics = pools[band];
    if (!topics || typeof topics !== "object") {
      throw new Error(`${band}: missing age pool`);
    }
    const names = Object.keys(topics).filter((name) => Array.isArray(topics[name]));
    const chosen = new Set();
    const counts = new Map(names.map((name) => [name, 0]));
    let selected = 0;

    while (selected < 30) {
      let progress = false;
      for (const name of names) {
        const ids = uniqueIds(topics[name]);
        let candidate = ids.find((id) => !chosen.has(id));
        if (!candidate) continue;
        chosen.add(candidate);
        counts.set(name, counts.get(name) + 1);
        selected++;
        progress = true;
        if (selected === 30) break;
      }
      if (!progress) {
        throw new Error(`${band}: cannot construct 30 unique questions from age pools`);
      }
    }

    result[band] = names
      .map((name) => [name, counts.get(name)])
      .filter(([, count]) => count > 0);
  }
  return result;
}

for (const slug of targetSlugs) {
  const dir = path.join(root, "data", "competitions", slug, "full-bank", "objective");
  const publicPath = path.join(dir, "questions.objective.public.json");
  const poolsPath = path.join(dir, "age-pools.json");
  const blueprintPath = path.join(dir, "selection-blueprint.json");

  // Thirukkural source recovery: rebuild from restored reviewed source before runtime materialization.
  // Thirukkural keeps its reviewed production bank in the dedicated
  // data/thirukkural tree. Materialize that same reviewed source into the
  // common competition runtime layout; do not synthesize or alter questions.
  if (slug === "thirukkural" && !fs.existsSync(publicPath)) {
    const sourceDir = path.join(root, "data", "thirukkural", "full-bank", "objective");
    const sourceFiles = [
      ["questions.objective.public.json", "questions.objective.public.json"],
      ["answer-key.objective.private.json", "answer-key.objective.private.json"],
      ["official-120.objective.json", "official.objective.json"],
      ["age-pools.json", "age-pools.json"],
    ];
    if (!sourceFiles.every(([from]) => fs.existsSync(path.join(sourceDir, from)))) {
      throw new Error("thirukkural: reviewed production source package is incomplete");
    }
    fs.mkdirSync(dir, { recursive: true });
    for (const [from, to] of sourceFiles) {
      fs.copyFileSync(path.join(sourceDir, from), path.join(dir, to));
    }
    console.log("MATERIALIZED reviewed Thirukkural runtime source package");
  }

  if (!fs.existsSync(publicPath) || !fs.existsSync(poolsPath)) {
    throw new Error(`${slug}: required reviewed bank/age-pool source is missing`);
  }

  const publicBank = read(publicPath);
  const pools = read(poolsPath);
  const privatePath = path.join(dir, "answer-key.objective.private.json");
  const officialPath = path.join(dir, "official.objective.json");
  const privateBank = read(privatePath);
  const officialBank = read(officialPath);
  if (!Array.isArray(privateBank) || !Array.isArray(officialBank)) {
    throw new Error(slug + ": private/official banks must be arrays");
  }
  if (!Array.isArray(publicBank)) throw new Error(`${slug}: public bank is not an array`);

  let poolsChanged = false;
  for (const band of bands) {
    if (!pools[band] || typeof pools[band] !== "object") {
      throw new Error(`${slug}: missing age band ${band}`);
    }

    const allIds = new Set(Object.values(pools[band]).flatMap(uniqueIds));
    if (allIds.size < 30) {
      if (!Array.isArray(pools[band].mixed)) pools[band].mixed = [];
      const mixedIds = new Set(uniqueIds(pools[band].mixed));
      for (const q of publicBank) {
        if (q?.age_band !== band || !q?.question_id || mixedIds.has(q.question_id) || allIds.has(q.question_id)) continue;
        pools[band].mixed.push(q.question_id);
        mixedIds.add(q.question_id);
        allIds.add(q.question_id);
        poolsChanged = true;
        if (allIds.size >= 30) break;
      }
    }
    if (allIds.size < 30) {
      throw new Error(`${slug}/${band}: only ${allIds.size} unique reviewed questions available; need 30`);
    }
  }

  if (poolsChanged) write(poolsPath, pools);

  // Reuse already-reviewed mock questions for missing official age-band coverage.
  // This never changes review_status or fabricates content; it only promotes existing
  // reviewed questions into the official set when an age band has fewer than 30.
  const officialIds = new Set(officialBank.map(q => q?.question_id).filter(Boolean));
  const privateIds = new Set(privateBank.map(q => q?.question_id).filter(Boolean));
  let officialChanged = false;
  for (const band of bands) {
    const count = new Set(officialBank.filter(q => q?.age_band === band).map(q => q?.question_id).filter(Boolean)).size;
    if (count >= 30) continue;
    for (const q of publicBank) {
      if (q?.age_band !== band || q?.review_status !== "reviewed" || !q?.question_id || officialIds.has(q.question_id)) continue;
      officialBank.push({ ...q, difficulty: q.difficulty || "championship", time_seconds: q.time_seconds || 75 });
      officialIds.add(q.question_id);
      if (!privateIds.has(q.question_id)) {
        privateBank.push({ ...q });
        privateIds.add(q.question_id);
      }
      officialChanged = true;
      if (new Set(officialBank.filter(x => x?.age_band === band).map(x => x?.question_id).filter(Boolean)).size >= 30) break;
    }
    const finalCount = new Set(officialBank.filter(q => q?.age_band === band).map(q => q?.question_id).filter(Boolean)).size;
    if (finalCount < 30) throw new Error(slug + "/" + band + ": only " + finalCount + " reviewed questions available for official coverage");
  }
  if (officialChanged) {
    write(officialPath, officialBank);
    write(privatePath, privateBank);
    console.log("REPAIRED official coverage: " + slug);
  }

  if (!fs.existsSync(blueprintPath)) {
    write(blueprintPath, makeBlueprint(pools));
    console.log(`CREATED blueprint: ${slug}`);
  } else {
    const existing = read(blueprintPath);
    const normalized = makeBlueprint(pools);
    for (const band of bands) {
      const total = Array.isArray(existing[band])
        ? existing[band].reduce((n, pair) => n + Number(pair?.[1] || 0), 0)
        : 0;
      if (total !== 30) {
        write(blueprintPath, normalized);
        console.log(`REPAIRED blueprint: ${slug}`);
        break;
      }
    }
  }

  console.log(`READY: ${slug}${poolsChanged ? " (age pools repaired)" : ""}`);
}
