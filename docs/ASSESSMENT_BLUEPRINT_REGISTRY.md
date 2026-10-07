# VATTAMS Academia — Executable Assessment Blueprint Registry

The blueprint registry is the runtime contract between an assessment definition and question selection.

## Required controls
- exact question count
- exact duration
- difficulty distribution summing to 100%
- section/topic quotas summing to the assessment question count
- eligibility constraints
- answer-release policy
- source blueprint provenance

## Publication rule
A reviewed or published assessment must resolve to an executable blueprint. There is no generic fallback blueprint.

## Runtime rule
The selector applies eligibility first, then blueprint quotas, then difficulty/topic distribution, then recent-repetition exclusion and randomization.

If the eligible bank cannot satisfy the complete blueprint, assessment start is blocked.

## Security
Blueprint configuration contains no answer key. Private answer keys remain in separate protected storage.

## Governance
This registry defines selection behavior; it does not approve content or make an unreviewed question publishable.
