# Assessment Result Review Release

The assessment question-content endpoint separates active-test delivery from post-submission review.

While an attempt is `in_progress`:
- correct answers are never returned;
- explanations are never returned;
- private scoring fields remain hidden.

After submission, review fields are released only according to the registered policy:
- `after_submission`: immediately after successful submission;
- `scheduled`: only after the configured release timestamp;
- `never`: never expose private review fields;
- `immediate_practice`: permitted for practice-oriented assessments.

The attempt's server release snapshot and bank integrity remain mandatory before either mode is served.