# Evidence-Backed Curriculum Mapping

This gate connects approved syllabus artifacts to the curriculum hierarchy.

## Rule

Every populated node must explicitly identify one or more approved evidence artifacts:

**Subject → Chapter → Topic → Subtopic → approved evidence**

Map-level evidence IDs must contain every node-level evidence ID.

## Controls

- Evidence must belong to the exact curriculum track.
- Evidence must be approved and contain a real 64-character SHA-256.
- Unsupported or unapproved evidence cannot back a node.
- Duplicate node IDs are rejected.
- Parent nodes must precede children.
- The validator never generates or guesses syllabus facts.
- If no approved evidence exists, the state remains **BLOCKED**.

This establishes traceability before lesson, practice, revision, question-bank, or assessment authoring begins.
