# VATTAMS Academia — Adaptive Question Selection

Adaptive selection is a server-side overlay for topic_practice assessments.

## Selection contract

The existing production gate remains authoritative: curriculum eligibility, class/exam eligibility, age-band eligibility, blueprint, difficulty distribution, topic distribution, recent-repetition exclusion, student-specific question shuffle, and option shuffle.

Adaptation happens only after eligibility, blueprint, difficulty/topic quotas, and recent-repetition controls have established the candidate set.

## Weak-topic signal

The server reads get_assessment_topic_performance using the Firebase JWT-derived student identity. The client cannot provide a student ID, accuracy, weak-topic list, or performance metrics.

A topic is adaptive-eligible only with at least 3 answered questions and accuracy below 60%.

## Targeting

For topic_practice, weak-topic candidates receive a strong ranking boost. Lower-accuracy weak topics receive an additional priority signal. The selector does not alter the published blueprint exact difficulty or topic distribution.

If a weak topic is not represented by the executable practice blueprint, the selector cannot inject it; the blueprint remains authoritative and the assessment fails closed when its required inventory cannot be satisfied.

## Security

The selector never returns private answer keys, explanations, hashes, or option permutations. Persisted option permutations remain server-side attempt state.
