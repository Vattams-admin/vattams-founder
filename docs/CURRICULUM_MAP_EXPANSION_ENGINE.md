# Curriculum Map Expansion Engine

The curriculum map is the authoritative structural layer between approved syllabus evidence and content authoring.

## Hierarchy

Every populated school curriculum map follows:

**Subject → Chapter → Topic → Subtopic**

The engine validates unique IDs, non-empty titles, required child arrays, and deterministic hierarchy.

## Evidence gate

The hierarchy cannot be populated unless approved syllabus evidence is explicitly linked through `evidenceIds`.

A blocked map may remain structurally empty while evidence is being captured and approved. The validator never creates curriculum facts.

## Publication gate

- Draft maps may be structurally empty while blocked.
- Any populated map requires evidence links.
- Non-draft maps require evidence links.
- Published maps must explicitly allow publication.
- A blocked map must keep both authoring and publication disabled.

## Separation of responsibilities

1. **Evidence ingestion** captures the authoritative source and SHA-256.
2. **Evidence approval** establishes that the source is verified and approved.
3. **Curriculum mapping** records the hierarchy supported by that evidence.
4. **Content authoring** creates lessons, examples, practice, revision and assessments from the approved map.
5. **Quality/CEO governance** controls publication.

This gate deliberately does not infer subjects, chapters, topics, or subtopics from web pages, filenames, or memory.
