# VATTAMS Academia — Question Blueprint & Randomized Assessment Selection Gate

## Purpose
The assessment selector is a server-side production gate. Randomness never replaces eligibility or blueprint rules.

## Mandatory selection order
1. Curriculum eligibility
2. Class/exam eligibility
3. Age-band eligibility
4. Assessment blueprint
5. Difficulty distribution
6. Topic distribution
7. Recent-repetition exclusion
8. Student-specific question shuffle
9. Option shuffle

A later stage may only operate on candidates that passed all earlier stages.

## Blueprint
Every published assessment must declare a blueprint containing:
- exact question count
- easy/medium/hard distribution summing to 1
- subject/topic distribution summing to 1

The selector never invents question IDs. Every selected ID must exist in the published public question bank.

## Eligibility
Curriculum and exam/class eligibility are evaluated before age-band filtering. Production questions must carry an age band. A candidate without the required locator metadata is not eligible for a production selection.

## Repetition control
The selector considers the student's three most recent submitted attempts for the same assessment. Recent questions are excluded when sufficient alternative eligible questions exist. If exclusion would make the requested blueprint impossible, the selector fails closed rather than silently violating the blueprint.

## Randomization
A cryptographically random student-specific seed creates a student-specific order. The persisted attempt stores the selected question IDs so resume/review is stable.

Options are shuffled independently while the private answer-key mapping remains server-side. The official payload contains only the question and four options plus permitted metadata.

## Security
- Public question banks must never contain correct answers or explanations.
- The selection layer never loads or returns private answer keys to the student.
- Official attempts never reveal answers before submission/release policy.
- Insufficient eligible inventory is a hard error.
- Validators do not publish or approve content.

## Thirukkural benchmark
Thirukkural Mastery Championship remains the reference runtime. The generalized selector is designed so competition, competitive-exam and school assessments can use the same production controls without weakening the existing official 30-question Thirukkural flow.
