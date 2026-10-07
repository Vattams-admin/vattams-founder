# Assessment Review Payload Minimization

Student-facing assessment responses expose only fields required for the learning/review experience.

Internal release pins, canonical hashes, integrity commitments, option permutations, storage paths, private answer-key metadata, and database implementation fields are never serialized into the response payload.

Review fields are included only after submission and only when the registered answer-release policy permits release.