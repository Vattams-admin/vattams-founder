# Server-Authoritative Assessment Scoring

Final scoring is derived only from:
- the server-persisted attempt question set;
- the verified public question bank;
- the verified private answer key;
- the server-persisted selected option indexes.

The client cannot submit score, maximum score, correctness, marks, or answer-key values.

For every selected question, the server validates the private correct option and marks, derives correctness, calculates awarded marks, and persists scored answer metadata.

Final attempt status and result creation occur through a service-role-only PostgreSQL function under a row lock. Invalid scores or answer counts are rejected.