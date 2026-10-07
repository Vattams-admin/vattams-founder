# Assessment Analytics Integrity

Student analytics are derived only from server-authoritative submitted assessment results.

In-progress attempts do not contribute to score analytics. The endpoint derives identity from the Firebase token and passes that identity to a service-role-only Postgres RPC. Clients cannot submit score, correctness, max-score, or attempt identifiers to influence the aggregate metrics.

Analytics responses contain summary metrics only; private answer keys, explanations, release hashes, option permutations, and integrity metadata remain unavailable.