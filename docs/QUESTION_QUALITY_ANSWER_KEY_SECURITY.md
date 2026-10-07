# Question Quality and Answer-Key Security Gate

Every production question must be traceable to the curriculum and carry enough metadata for controlled selection.

## Mandatory quality fields

- unique question ID
- exact curriculum locator
- age band
- difficulty
- provenance
- exactly four unique options
- private correct option index
- non-empty reasoning

## Security

The public question object must never contain the correct option or explanation. The private answer key is stored separately and must map one-to-one to production questions.

Official attempts keep the answer hidden during the attempt. Practice/review can release the answer and reasoning only after the configured submission/release policy.

The gate rejects duplicates, missing metadata, invalid answer indices, missing explanations, orphan keys and unauthorized publication.

No question is promoted merely because it passes structural validation; quality review and governance remain mandatory.
