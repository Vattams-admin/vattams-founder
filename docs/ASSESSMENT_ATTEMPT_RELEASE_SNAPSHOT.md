# Assessment Attempt Release Snapshot

When a published assessment attempt starts, the runtime stores the exact:
- release version
- public bank SHA-256
- private answer-key SHA-256

Question delivery, answer saving, and submission compare the attempt snapshot with the current published registry.

If the release changes, the attempt fails closed instead of switching content mid-attempt.

This preserves a reproducible assessment experience and prevents a later publication from altering an already-started attempt.