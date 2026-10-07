# Controlled Assessment Promotion

Assessment status changes are fail-closed and must use `scripts/promote-assessment.mjs`.

## Allowed transitions

- `draft -> reviewed`
- `reviewed -> published`

Direct `draft -> published` is forbidden.

## Review promotion

Requires:
- ready executable blueprint
- ready blueprint coverage
- publication audit with explicit reviewer/approval identity and timestamp
- version history

## Publication promotion

Requires all review gates plus:
- existing `reviewed` status
- publication audit decision `approved_for_publication`
- explicit approval identity and timestamp
- current version history

The command does not generate content, reviewers, timestamps, hashes, or approvals. Published assessments cannot be mutated through promotion; a new version must be created and audited.
