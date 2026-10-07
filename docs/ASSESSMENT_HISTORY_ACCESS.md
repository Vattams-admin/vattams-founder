# Assessment History Access

The student assessment history API is Firebase-authenticated and server-scoped to the authenticated student ID.

History is paginated and ordered by server-side `started_at` descending. It returns attempt/result summaries only: assessment identity, status, timestamps, score, max score, and submitted answer count.

Private answer keys, explanations, option permutations, release hashes, integrity commitments, and other internal scoring metadata are excluded. Direct client database access remains revoked.