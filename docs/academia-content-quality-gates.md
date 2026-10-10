# VATTAMS Academia — Cross-Pillar Content Quality Gates

This standard applies to **all authored content**, not only language-learning packs. It covers the three pillars: Courses, Competitive & Entrance Exams, and Competitions & Olympiads. Apply only checks relevant to each content type; a generic schema must not force course-only fields onto exams or competitions.

## 1. Identity and structure
- [ ] Every item has a stable, non-empty ID and clear title.
- [ ] Parent/child relationships resolve; no orphaned lessons, units, questions, options, or assessments.
- [ ] IDs are unique in their intended scope; intentional reuse across different languages, courses, exams, or competitions is allowed.
- [ ] Required fields are present and values use documented types/enums.
- [ ] Ordering, sequence numbers, and references are valid and deterministic.

## 2. Learning and assessment quality
- [ ] Lessons/materials have clear learning outcomes and appropriate explanations, examples, and practice for the intended level.
- [ ] Questions have a meaningful prompt, valid options where applicable, an unambiguous correct answer unless multiple answers are explicitly supported, and an explanation/rationale.
- [ ] Correct-answer references resolve to real options; private answer keys are not exposed in learner-facing payloads.
- [ ] Empty, placeholder, copied boilerplate, or contradictory content is not treated as production-ready.
- [ ] Duplicate detection is scoped to the same collection and uses normalized content; legitimate repeated concepts across separate courses/languages/exams are not false positives.

## 3. Pillar-specific coverage
### Pillar 1 — Courses
- [ ] Course → units/modules → lessons → concepts/materials → examples/activities → question bank/practice → assessment/revision links are coherent.
- [ ] Lesson objectives, teaching content, examples, activities, practice and revision align.
- [ ] Progress/completion references point to stable lesson IDs.

### Pillar 2 — Competitive & Entrance Exams
- [ ] Exam, syllabus/domain, topic/subtopic, difficulty, question type and target level are explicit where required.
- [ ] Coverage is measured against the declared exam blueprint; a small sample/mock test is not a complete preparation library.
- [ ] Mock-test question counts, timing, marks, negative marking and answer keys agree with exam configuration.
- [ ] Explanations and distractors are reviewed for accuracy and exam relevance.

### Pillar 3 — Competitions & Olympiads
- [ ] Competition identity, domains, eligibility, rules, scoring and attempt configuration agree across catalog, preparation materials and runtime.
- [ ] Official question sets have the declared count, stable unique IDs and valid answer keys.
- [ ] Study materials and mock tests are distinct from the official attempt; practice content must not silently substitute for the official set.
- [ ] Entry/pricing metadata is consistent where applicable; content validation must not perform payments or remote writes.

### Cross-cutting language/localization
- [ ] Locale, script, writing direction, translated examples and UI strings are checked where applicable.
- [ ] Unreviewed translations/scaffolds remain explicitly flagged; catalogue presence does not mean translation is complete.
- [ ] Unicode, fonts, layout, accessibility and mobile rendering are reviewed for supported scripts.

## 4. Validation layers
1. **Static structural validation:** parseable files, required fields, valid IDs/references, duplicate checks, enum/type constraints and expected counts.
2. **Content review:** correctness, clarity, level suitability, localization and subject-matter review. A regex validator cannot certify factual correctness.
3. **Runtime validation:** render/consume content in the relevant course, exam, competition or language flow; verify navigation, scoring and progress.
4. **Security validation:** answer-key separation, authorization/enrolment checks, and no learner access to private/admin-only fields.
5. **Release verification:** build/typecheck/lint, targeted tests, relevant E2E checks, and visible CI results before release.

## 5. Readiness states
- `draft`: content is being authored; not learner-ready.
- `in_review`: structure is valid and awaiting human/content review.
- `approved`: structural checks and required human review are complete.
- `published`: approved content has passed relevant runtime/security/release gates and is available through the intended production catalog.

Do not promote content automatically to `approved` or `published` just because a script exits successfully. Report coverage counts separately from verified production readiness.

## 6. Safe implementation rules
- Validators should be read-only and deterministic; they must not write to Firebase, Supabase, production catalogues, payments or learner records.
- Keep pillar-specific adapters for each actual content schema and share common validation helpers only where semantics match.
- Scope duplicate checks to the correct parent collection and normalized content, and add fixtures for known false-positive cases.
- A validator is not operational until its command is executed and its CI result is observed. Record unexecuted checks as pending.
