# Assessment Remediation Engine

Remediation is a server-derived learning signal built from submitted, server-scored assessment answers.

## Weak-topic policy

A topic is considered weak only when it has at least 3 answered questions and accuracy is below 60%. Empty subject/topic metadata is excluded so the engine never invents a learning location.

## Remediation sequence

Each weak topic receives this ordered learning path:
1. weak_topic_revision
2. topic_practice
3. topic_reassessment

Recommendations are ranked by lowest accuracy first, then higher answered volume, and limited by the configured maximum. The endpoint derives student identity from the Firebase token and never accepts a student ID. It returns only remediation metadata and never returns answer keys, explanations, hashes, option permutations, or private scoring fields.
