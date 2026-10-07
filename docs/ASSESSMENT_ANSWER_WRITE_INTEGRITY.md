# Assessment Answer Write Integrity

Answer persistence is server-authoritative.

Before writing an answer, the runtime validates:
- authenticated student owns the attempt;
- attempt release snapshot and integrity commitment are valid;
- attempt is active and unexpired;
- question ID belongs to the immutable attempt question set;
- selected option index is within the four-option range;
- persisted option permutation is a valid permutation.

The final write uses a PostgreSQL function that locks the attempt row and atomically checks its state, expiry, and question membership before upserting the answer.

The function is executable only by the Supabase service role, preventing a race where submission could occur between a runtime state check and the answer write.