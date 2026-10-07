import crypto from "node:crypto";

const sample = [{ question_id: "HASH-CONTRACT-01", question: "Example", options: ["A","B","C","D"] }];
const canonical = (value) => JSON.stringify(value);
const hash = (value) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

const pretty = JSON.stringify(sample, null, 2);
const compact = JSON.stringify(sample);
if (hash(JSON.parse(pretty)) !== hash(JSON.parse(compact))) {
  throw new Error("Canonical assessment bank hash contract is not formatting-stable");
}

console.log("Assessment bank hash contract test passed.");