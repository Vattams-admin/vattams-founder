# VATTAMS Academia — Production Question-Bank Packager

The packager consumes only an already-approved ingestion package.

It deterministically emits:
- public question bank without answer fields
- private answer-key bank
- SHA-256 manifest for both banks

It refuses to package unapproved content, missing private keys, duplicate IDs, or mismatched public/private counts.

Packaging is not content approval. The resulting files still require the assessment registry, quality/security, blueprint coverage, and publication gates.