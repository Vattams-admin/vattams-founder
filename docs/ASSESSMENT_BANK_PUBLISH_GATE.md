# VATTAMS Academia — Assessment Bank Publish Gate

Production assessment publishing is fail-closed.

Before registry publication:
1. assessment registry validation runs;
2. packaged bank registration validation runs;
3. blueprint registry validation runs;
4. reviewed/published assessments must have a registered manifest, public bank, and private answer key;
5. manifest identity, question count, private-key flag, and SHA-256 integrity are verified.

Only validated bank assets are uploaded to the `academia-course-materials` bucket. Draft assessments without packaged banks are not uploaded. The private answer key is never included in the public question payload.