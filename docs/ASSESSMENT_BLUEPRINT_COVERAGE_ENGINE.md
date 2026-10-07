# VATTAMS Academia — Assessment Blueprint Coverage Engine

The coverage engine is the inventory gate before a blueprint can become executable.

## It verifies
- reviewed question inventory
- eligible question inventory
- section coverage
- difficulty coverage
- topic coverage
- exam/class/curriculum/age eligibility metadata
- private answer-key availability
- unique question IDs

## Ready means sufficient inventory
A blueprint can only become ready when every required quota has enough independently reviewed questions and all required eligibility metadata exists.

The engine never creates questions and never estimates missing coverage.

## Fail closed
Missing inventory, missing metadata, insufficient difficulty/topic coverage, or missing private keys keeps the blueprint blocked.

## Separation
Blueprint design defines what an assessment needs. Coverage evidence proves the question bank can satisfy it. Neither layer approves content by itself.
