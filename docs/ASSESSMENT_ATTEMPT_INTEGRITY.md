# Assessment Attempt Integrity

Every new assessment attempt receives a server-generated SHA-256 commitment over:
- release version
- public bank hash
- private answer-key hash
- selected question IDs
- private option permutations

The commitment is stored server-side.

Question delivery, answer saving, and submission recompute and verify it. A mismatch fails closed.

The selected question set and option permutation are therefore server-owned scoring inputs rather than trusted client state.