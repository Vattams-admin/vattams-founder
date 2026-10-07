# Production Content Coverage

This layer measures what production content actually exists and what remains missing.

## Evidence sources

- `config/content-library-registry.json` — canonical package conventions.
- `config/competition-registry.json` — registered competition runtime targets.
- `config/assessment-registry.json` — registered assessment targets.
- `content/**/manifest.json` — actual package evidence.

## Status semantics

- `missing`: no matching package manifest.
- `draft`: package exists but is not ready.
- `in_review`: package is under quality review.
- `approved`: approved but not yet published.
- `published`: production-published according to its manifest.
- `retired`: no longer active.

The report never promotes content. It only measures repository evidence.

CI generates `reports/production-content-coverage.json` as an artifact instead of committing it, because the timestamp is generated data.

A registry entry alone is never treated as completed content.
