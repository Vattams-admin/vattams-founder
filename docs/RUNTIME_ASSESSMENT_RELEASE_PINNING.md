# Runtime Assessment Release Pinning

Published assessments carry:
- `release_version`
- `release_public_sha256`
- `release_private_sha256`

The production runtime compares these values with the bank manifest before serving questions, accepting answers, or submitting/scoring an attempt.

A mismatch fails closed. The promotion command derives these values only from the approved version history and the actual current bank hashes.

Draft/reviewed assessments do not receive runtime release pins.