# Syllabus Artifact Ingestion

Use `scripts/capture-syllabus-artifact.mjs` only with a real source artifact obtained through an approved evidence process.

Example:

`node scripts/capture-syllabus-artifact.mjs ./evidence/cbse-class-1.pdf --artifact-id cbse-class-1-2026-27-primary --track-id school-cbse-class-1 --source-type official_curriculum_document --source-title "CBSE Primary Curriculum 2026-27" --source-locator "https://cbseacademic.nic.in/..." `

The command:

1. requires the actual local file;
2. reads the binary bytes;
3. calculates SHA-256 locally;
4. emits a registry record with status `captured`;
5. never changes a record to `verified` or `approved`;
6. never unlocks authoring.

The resulting record must be reviewed and added to the syllabus artifact registry through the normal governance workflow.

Never substitute a URL hash, filename hash, placeholder digest, or manually typed digest for the digest calculated from the actual artifact.
