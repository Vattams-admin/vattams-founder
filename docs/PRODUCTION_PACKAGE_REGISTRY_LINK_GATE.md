# Production Package Registry-Link Gate

This gate verifies that every production content manifest resolves to the canonical registries before publication.

It validates:
- manifest domain against the content-library registry
- competition locators against competition-registry.json
- competition question/answer bundle declarations
- competitive-exam package locators against assessment-registry.json
- assessment evidence for every non-retired assessment in the package course
- published-package minimum coverage for study materials, questions and assessments
- private answer-key governance

The gate never creates, promotes, or invents content.