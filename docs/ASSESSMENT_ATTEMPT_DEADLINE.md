# Assessment Attempt Deadline

Each new attempt receives an immutable `expires_at` calculated server-side from the attempt's server timestamp and the published assessment's `time_seconds`.

Runtime behavior:
- resume rejects an expired in-progress attempt;
- question delivery rejects an expired attempt;
- answer saving rejects an expired attempt;
- submission rejects an expired attempt;
- later changes to the assessment registry duration do not alter an existing attempt deadline.

The client does not supply or control the deadline.