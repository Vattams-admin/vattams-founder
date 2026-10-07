import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const [, , sourcePath, ...args] = process.argv;
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

if (!sourcePath) {
  console.error("Usage: node scripts/capture-syllabus-artifact.mjs <source-file> --artifact-id <id> --track-id <track> --source-type <type> --source-title <title> --source-locator <url>");
  process.exit(1);
}
if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
  console.error("SOURCE ARTIFACT NOT FOUND: " + sourcePath);
  process.exit(1);
}

const required = ["artifact-id","track-id","source-type","source-title","source-locator"];
for (const name of required) {
  if (!getArg(name)) {
    console.error("MISSING REQUIRED ARGUMENT: --" + name);
    process.exit(1);
  }
}

const bytes = fs.readFileSync(sourcePath);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
const artifactId = getArg("artifact-id");
const trackId = getArg("track-id");

const record = {
  artifactId,
  trackId,
  sourceType: getArg("source-type"),
  sourceTitle: getArg("source-title"),
  sourceLocator: getArg("source-locator"),
  retrievedAt: new Date().toISOString(),
  sha256,
  status: "captured",
  supersedesArtifactId: null
};

console.log(JSON.stringify(record, null, 2));
console.log("");
console.log("ARTIFACT CAPTURED — SHA-256 calculated from the supplied file.");
console.log("Governance remains locked: captured != verified != approved.");
console.log("Do not change status to verified/approved without the required human evidence review.");
console.log("Suggested registry target: config/syllabus-artifact-registry.json");
