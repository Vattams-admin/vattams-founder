# Evidence-to-Curriculum Map Link

The CBSE Class 1 curriculum map may advance only when the syllabus artifact registry contains an artifact for the exact track with:

- status = `approved`
- a real 64-character SHA-256 digest
- matching `trackId`

Every approved artifact must also be explicitly listed in the curriculum map's `evidenceIds`.

This gate does not approve content. It only proves that the curriculum map is anchored to approved evidence. Lesson/question/assessment publication remains subject to the existing quality, provenance, answer-key, assessment and CEO governance gates.

When no approved artifact exists, the validator exits successfully with a BLOCKED state. This is intentional: missing evidence is a controlled state, not a CI failure.
