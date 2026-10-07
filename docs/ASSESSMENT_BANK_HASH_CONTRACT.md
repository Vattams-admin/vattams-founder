# Assessment Bank Hash Contract

VATTAMS Academia assessment-bank SHA-256 values are computed over the canonical JSON representation:

`SHA-256(JSON.stringify(parsedJson))`

The same contract is used by:
- production question-bank packager
- repository registration validator
- Supabase runtime integrity checks

Formatting-only changes to JSON therefore do not invalidate a registered bank, while any semantic change to the parsed bank does.

Private and public bank hashes are always tracked independently.