# Assessment Attempt State Machine

Assessment attempts have one legal terminal transition:

`in_progress -> submitted`

Submission uses a PostgreSQL atomic transition function. The update requires the attempt to still be `in_progress`, belongs to the authenticated student, and has not expired.

Consequences:
- simultaneous submissions cannot both succeed;
- a second submission fails closed;
- answer saving requires an active attempt;
- expired attempts cannot accept answers;
- the client cannot directly perform the terminal state transition.

The transition function is executable only by the Supabase service role.