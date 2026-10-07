# VATTAMS Academia — Production Question Ingestion

Production question imports must satisfy the canonical public/private contract before entering an assessment bank.

Required per question: unique ID, exactly four unique options, explicit blueprint section ID, subject/topic/subtopic, language, difficulty, age band, exam ID, marks, expected time, provenance, and reviewed status.

Private key requirements: matching question ID, correct option index, reviewed explanation. Public question records must not contain the answer or explanation.

Governance requires private answer keys and source evidence. This gate validates structure and security only; it does not approve content or invent missing metadata.


For blueprint-controlled assessments, `sectionId` is mandatory at ingestion and is emitted as `section_id` in the public bank. Coverage tooling counts only questions that satisfy the complete eligibility contract; it never infers a section from subject names.
