# VATTAMS Academia — Assessment Bank Registration Governance

Every assessment registry entry declares its packaged bank manifest.

The registration gate verifies:
- manifest assessment identity
- question count
- public-bank path
- private-answer-key path
- private-key flag
- SHA-256 parity with the registered files
- required bank files for reviewed/published assessments

Draft assessments may remain unmaterialized. Reviewed or published assessments cannot bypass the packaged-bank manifest and hash checks.