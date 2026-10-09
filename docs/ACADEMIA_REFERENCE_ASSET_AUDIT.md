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

## Thirukkural recovery dependency chain (follow-up inspection)

The checked-in npm scripts define `thirukkural:production-gate` as:

```sh
npm run thirukkural:build-official
npm run thirukkural:validate
npm run thirukkural:package
```

This chain cannot be assumed to work in the current source snapshot because the official builder requires the objective public bank, private key bank, and age pools; the validator also requires the full objective banks and official-120 output. The source tree inspection found age pools and a selection blueprint, but not these required JSON artifacts. The upstream builder `scripts/build-thirukkural-objective-bank.py` itself expects `data/thirukkural/full-bank/questions.public.json` and `answer-key.private.json`, which were also absent from the inspected tree.

Recovery must therefore start by locating an authoritative copy of those 9,443 source question/answer rows or rebuilding them through the approved source-generation pipeline. Do not run a partial downstream build and do not create placeholder banks. Once the authoritative inputs are restored, execute the documented production-gate command in a proper Node/Python environment, inspect the generated manifest/registry paths, and run the relevant E2E check before calling the competition ready.

## Follow-up — registry target existence audit

A second tree pass compared registry file references against tracked branch paths. This did not query live storage or execute packaging scripts.

### Competition package targets

- The registry has 24 competitions. For each entry, the configured question bundle, private answer-key bundle, and age-pool bundle are absent at their configured `competitions/<slug>/objective/` paths in this source snapshot (0 of 24 sets found at those exact targets).
- This is a target-path availability finding, not proof that all 24 source banks are absent: registry paths may be generated by the packaging pipeline. Thirukkural is the only competition with the detailed source/build-chain investigation documented above; the other 23 need a per-competition source and packaging audit before readiness can be asserted.
- Do not expose or create public answer-key files to make the paths exist. Confirm each competition's trusted source assets, packaging output, and runtime loader contract first.

### Competitive-exam assessment targets

- All three TNPSC Group IV / VAO assessment entries are marked `draft` in `config/assessment-registry.json`.
- For each, the configured public question bank, private answer key, and per-assessment manifest are absent at their exact tracked paths under `assessments/competitive-exam/tnpsc-group-iv-vao/` (0 of 9 target files found).
- Blueprint, registry and tooling exist, but the three entries and their declared 200-question counts do not establish that usable question-bank assets are present. Restore or generate approved exam-specific banks and private keys, then validate blueprint coverage, answer mapping and publishing behavior before changing draft status.

### Pillar-level interpretation

- Courses / Phonics: 143 lesson authoring packages are present against the 1,200-lesson target; the manifest is draft.
- Competitive exams: 3 TNPSC mock definitions are registered, but their 9 declared target files are absent from the tracked source tree.
- Competitions: 24 definitions are registered, but their 72 configured bundle targets are absent from the tracked source tree. Some may be build/package outputs; inspect the package pipeline and source banks per competition before treating this as missing authored content.

These findings are repository-path checks only. No package command, validator, runtime test, CI job, or live Firebase/Supabase operation was run.