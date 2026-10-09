# VATTAMS Academia Reference Asset Audit

Audit scope: repository tree and file contents on `feat/academia-core-redesign`.
This is a source-repository inventory, not a live Firebase/Supabase production audit.

## Pillar 1 — Phonics Foundation

- Course directory exists at `content/courses/phonics-foundation/`.
- Manifest currently declares status `draft`, 2 modules, 143 lessons, 143 study materials, 2,135 questions, and 34 assessments.
- The repository tree contains 143 lesson `authoring-package.json` files.
- Project target remains 1,200 lessons. The observed 143 packages are a partial source inventory, not evidence that the 1,200-lesson target is complete.
- Keep Phonics as its own course package and do not copy its content into competition or exam banks.

## Pillar 2 — Competitive and Entrance Exams

- `config/assessment-registry.json` contains 3 registered TNPSC Group IV / VAO mock assessments.
- Assessment blueprint, selection, registration, publication and runtime tooling exists.
- In the inspected source tree, `content/courses/` contains only `phonics-foundation`; no broad course-style entrance-exam lesson library was found there.
- Treat the three registered mocks as existing assets, not as proof of comprehensive exam coverage across engineering, medical, law, management, professional qualifications or other entrance pathways.

## Pillar 3 — Thirukkural Mastery Championship

- Competition registry contains 24 competition entries, including Thirukkural Mastery Championship.
- Thirukkural manifest is marked `approved` and declares 9,443 questions, 2 study-material assets and 2 assessments.
- Authored reference files exist:
  - `content/competition-study-materials/authored-v2/thirukkural-mastery-championship-core.json`
  - `content/competition-study-materials/authored-v2/thirukkural-mastery-championship-four-layer-coverage.json`
- Age pools and selection blueprint exist under `data/competitions/thirukkural-mastery-championship/full-bank/objective/`.
- The competition registry defines 30 questions per attempt and separate age-specific official paper IDs.
- The source tree inspected does **not** contain the following paths referenced by the current manifest/registry:
  - `competitions/thirukkural-mastery-championship/objective/questions.private.json`
  - `competitions/thirukkural-mastery-championship/objective/answer-keys.private.json`
  - `competitions/thirukkural-mastery-championship/objective/age-pools.json`
- The tracked source tree also does not contain the files currently required by `scripts/validate-thirukkural-production.mjs`:
  - `data/thirukkural/full-bank/objective/questions.objective.public.json`
  - `data/thirukkural/full-bank/objective/answer-key.objective.private.json`
  - `data/thirukkural/full-bank/objective/official-120.objective.json`
- The canonical Kural source `data/thirukkural/thirukkural.json` and `data/thirukkural/detail.json` do exist. Build/package scripts exist to generate downstream assets, but generation has not been executed as part of this audit.
- Do not mark the bank runtime-ready solely from manifest counts. Regenerate the intended artifacts using the project scripts, verify generated paths and private/public separation, then run the dedicated Thirukkural validator and runtime E2E checks.

## Required next actions

1. Regenerate and validate the missing Thirukkural bank/package artifacts in a proper repository execution environment; do not fabricate a replacement bank.
2. Reconcile manifest and registry references with the intended generated output paths without exposing private answer keys.
3. Audit the 143 existing Phonics lesson packages against the learning-quality standard, then expand toward the 1,200-lesson target.
4. Expand exam preparation from the existing registered TNPSC mocks into syllabus-specific course/subject libraries and exam-specific question banks.
5. Audit the remaining 23 competition entries for their own subject-specific study materials, public banks, private answer keys, age/difficulty blueprints and independent official selectors.
6. Run validation scripts and CI before declaring any pillar production-ready.

## Verification limitation

No local build, validator, test suite, CI workflow, or live backend query was executed during this repository inventory. Counts and missing paths above reflect the inspected GitHub source tree only.
