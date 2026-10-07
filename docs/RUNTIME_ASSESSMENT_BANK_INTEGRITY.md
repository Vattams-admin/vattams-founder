# Runtime Assessment Bank Integrity

Published assessment execution is fail-closed against the registered question-bank manifest.

At assessment start, question delivery, answer saving, and submission/scoring verify the registered manifest and canonical SHA-256 hashes.

The manifest must match:
- assessment ID
- question count
- public question-bank path
- private answer-key path
- private-answer-key flag

The runtime hashes the parsed canonical JSON representation, matching the production packager's hashing contract.

If a bank, private key, manifest, path, or hash is changed unexpectedly, the operation is blocked. Public question delivery never returns private scoring fields.