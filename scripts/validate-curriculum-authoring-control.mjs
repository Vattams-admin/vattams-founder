import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const control = JSON.parse(fs.readFileSync(path.join(root, "config/curriculum-authoring-control.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "config/curriculum-authoring-control.schema.json"), "utf8"));
const errors = [];
const fail = (m) => errors.push(m);

if (control.version !== 1) fail("control version must be 1");
if (control.controlId !== schema.properties.controlId.const) fail("invalid controlId");
if (control.rules?.evidenceRequiredBeforeAuthoring !== true) fail("evidenceRequiredBeforeAuthoring must be true");
if (control.rules?.approvedEvidenceRequiredBeforeReview !== true) fail("approvedEvidenceRequiredBeforeReview must be true");
if (control.rules?.approvedEvidenceRequiredBeforePublish !== true) fail("approvedEvidenceRequiredBeforePublish must be true");

const validEvidence = new Set(["missing","collected","verified","approved","superseded"]);
const validContent = new Set(["not_started","authoring","in_review","approved","published","retired"]);
const ids = new Set();

for (const track of control.tracks ?? []) {
  if (!track.trackId) fail("trackId is required");
  if (ids.has(track.trackId)) fail("duplicate trackId: " + track.trackId);
  ids.add(track.trackId);

  if (!validEvidence.has(track.evidenceStatus)) fail("invalid evidenceStatus: " + track.trackId);
  if (!validContent.has(track.contentStatus)) fail("invalid contentStatus: " + track.trackId);

  const evidenceApproved = track.evidenceStatus === "approved";
  const evidenceAttached = Array.isArray(track.evidenceIds) && track.evidenceIds.length > 0;

  if (track.contentStatus !== "not_started" && !evidenceAttached) {
    fail("content cannot advance without evidenceIds: " + track.trackId);
  }
  if (["in_review","approved","published"].includes(track.contentStatus) && !evidenceApproved) {
    fail("content review/publication requires approved syllabus evidence: " + track.trackId);
  }
  if (track.contentStatus === "published" && track.evidenceStatus !== "approved") {
    fail("published content requires approved evidence: " + track.trackId);
  }
  if (track.evidenceStatus === "superseded" && track.contentStatus !== "retired") {
    fail("superseded evidence cannot support active content: " + track.trackId);
  }
}

if (errors.length) {
  console.error("CURRICULUM AUTHORING CONTROL INVALID");
  errors.forEach((e) => console.error("- " + e));
  process.exit(1);
}

console.log("CURRICULUM AUTHORING CONTROL VALID");
console.log("Controlled tracks: " + control.tracks.length);
console.log("Approved evidence tracks: " + control.tracks.filter(t => t.evidenceStatus === "approved").length);
console.log("Blocked tracks awaiting evidence: " + control.tracks.filter(t => t.evidenceStatus !== "approved").length);
