# Production Package Manifest Standard

Every genuinely produced VATTAMS Academia content package should have a `manifest.json` at its package root.

The manifest records:
- stable package identity and semantic version
- canonical content domain and locator
- package status
- counts for study materials, questions and assessments
- public question-bank paths
- private answer-key paths
- source evidence
- review/approval state
- content hash and version lineage

## Publication rule

A package is not production-ready merely because its manifest exists. Published packages must have reviewed/approved governance metadata, source evidence, and a content hash. Official assessment answers remain private.

## No fake completeness

A zero-question or zero-material manifest is valid for a newly registered package, but it must remain `draft`/in_review until genuine content is authored and reviewed. The validator never invents or promotes content.
