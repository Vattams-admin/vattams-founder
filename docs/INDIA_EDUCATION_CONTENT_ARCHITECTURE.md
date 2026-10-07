# VATTAMS Academia — India-wide Content Architecture

## Scope

VATTAMS Academia is a pan-India, multilingual education platform. The canonical education registry covers all 28 states, all 8 Union Territories, Class 1–12, national curricula, state/UT curricula, international curricula, competitive exams, entrance exams, professional exams and VATTAMS competitions.

## School hierarchy

`State/UT → Curriculum → Class → Subject → Chapter → Topic → Subtopic → Language`

Language is deliberately independent from state and curriculum so the same learning model can support permitted multilingual delivery without duplicating the core data model.

## Learning package

Each production lesson may contain:

- complete study material
- concept explanations and definitions
- worked examples
- visuals where appropriate
- practice questions
- revision and recall
- formula/key-point banks where relevant
- common mistakes
- weak-topic remediation
- topic, chapter, sectional and full mock assessments

## Question standard

Objective MCQs use exactly four unique options. Public assessment payloads must not expose the correct answer or explanation. Private answer keys remain protected. Question selection is blueprint-controlled, options may be randomized, and student question order can be individualized.

Curriculum eligibility is evaluated before age filtering. Age suitability is an additional safeguard, not a substitute for curriculum alignment.

## Assessment modes

- Practice
- Topic test
- Chapter test
- Subject test
- Sectional test
- Mock test
- Official attempt

Practice/review experiences can reveal correct answers and reasoning according to policy. Official attempts must protect answers until the configured result-release policy allows them.

## Translation and multilingual governance

Translation is a content version, not merely a UI string. Translated educational content requires review before publication. Machine translation can assist drafting but cannot auto-publish official learning or assessment content.

## Publishing governance

Production content follows:

`Draft → Automated Validation → Quality Review → CEO Approval → Published → Retired`

Every production version must retain an audit trail including content ID, version, approver, approval timestamp, content hash and previous version reference.

## Exam families

The platform foundation includes TNPSC/state public service, UPSC, SSC, banking, railway, defence/uniformed services, state recruitment, NEET, JEE, CUET, law entrance, CA, CMA, CS and an extensible category for other entrance/professional examinations.

## Reference implementation

Thirukkural Mastery Championship remains the competition reference implementation. New competition runtimes must preserve its production principles while using the shared content and assessment architecture rather than creating isolated schemas.
