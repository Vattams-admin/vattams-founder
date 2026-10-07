# VATTAMS Academia — Production Content Library

The production library is organized by the canonical content locator rather than by UI page names. This keeps School, Competitive Exams, Entrance Exams, Professional Education, and Competitions on one content model.

## Storage convention

`content/<domain>/...` is the logical authoring/package root.

- School: `school/{state-or-national}/{curriculum}/{class}/{subject}`
- Competitive exams: `competitive-exams/{exam-family}/{exam}/{course}`
- Entrance exams: `entrance-exams/{exam-family}/{exam}/{course}`
- Professional: `professional/{family}/{exam-or-qualification}/{course}`
- Competitions: `competitions/{competition-slug}`

A registry entry is **not** an assertion that content exists. A package becomes production-ready only after genuine content is authored, validated, reviewed, approved, and published.

## Package shape

Each production package can contain:

1. Study material / lessons
2. Practice questions
3. Revision / flash recall / formula bank / weak-topic revision
4. Assessments
5. `manifest.json`
6. Review/audit metadata

Objective MCQs follow the unified package schema: four unique options, answer key kept private, reviewed status before publication, and blueprint-controlled assessment selection.

## School coverage

The registry supports Classes 1–12 and the existing India education registry's national, state, private/matriculation, and international curriculum families. Exact chapter and subject inventories must come from the relevant official/current syllabus before being marked reviewed.

## Production rule

Do not manufacture placeholder question banks just to satisfy a registry. The registry provides routing and governance; authored content remains a separate production deliverable.
