# Assessment Attempt Lifecycle

The assessment engine permits at most one `in_progress` attempt for a student and assessment. The database enforces this with a partial unique index, so concurrent start requests cannot create duplicate active attempts.

When an active attempt already exists, `start_or_resume` returns that persisted attempt and its original question set, option permutations, release snapshot, integrity commitment, and immutable deadline. Submitted attempts remain history and are returned deterministically rather than silently creating a new attempt.

A uniqueness race is handled server-side by reloading the winning attempt. No client-supplied attempt state is trusted.