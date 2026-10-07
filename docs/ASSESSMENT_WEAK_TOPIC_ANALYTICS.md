# Assessment Weak-Topic Analytics

Weak-topic analytics are derived only from server-scored answers belonging to submitted attempts owned by the authenticated student.

Each scored answer stores reviewed question metadata (`subject`, `topic`, `subtopic`) separately from the student's raw answer. The scoring path derives correctness, correct option, explanation, and marks from the private key, then persists the complete server-authoritative scored record before finalizing the result.

The student endpoint returns topic-level attempt counts, correct counts, accuracy, and marks awarded. It never returns private answer keys, explanations, release hashes, or integrity metadata.