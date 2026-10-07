# VATTAMS Academia Master Learning Architecture

## Canonical model

Every production package follows:

**Eligibility → Study Material → Lesson → Practice → Revision → Mock → Official Attempt → Result → Targeted Revision**

The Thirukkural Mastery Championship is the reference implementation for competition flow, four-option objective questions, private answer keys, randomized papers and age-band eligibility.

## School library

School content starts at **Class 1** and is independently segregated by:

- State / Union Territory
- Curriculum / board
- Class
- Subject
- Chapter
- Topic
- Subtopic
- Language
- Age band

Supported curriculum families include CBSE, CISCE (ICSE/ISC), NIOS, state/UT boards, matriculation/state-specific private curricula, IB, Cambridge International and Pearson Edexcel.

No state-board package is treated as interchangeable with another state's syllabus. Each package must be authored/reviewed against its applicable official curriculum and source evidence.

## Learning package standard

Each lesson should contain complete notes, objectives, concepts, definitions, worked examples, common mistakes, key takeaways, practice questions, revision points, flash recall and weak-topic revision where applicable.

Questions require four unique options, verified answer keys, reasoning, provenance, difficulty, expected time and review metadata.

## Assessment behavior

### Practice / mock

The learner may receive the correct answer and reasoning after the configured practice/review point.

### Official test

The learner sees only:

- question
- four options
- permitted metadata

The correct option and explanation remain private until the configured result-release policy.

Scoring is server-side.

### Randomization

Selection is blueprint-controlled. The platform can randomize:

- eligible question selection
- question order
- option order

It must never randomize away eligibility, blueprint requirements, marks or the verified correct-answer identity.

Recent-question repetition is actively controlled.

## Age and class handling

For school content, curriculum eligibility and class are established first, then age suitability is applied.

For competitions, the registered age band is a hard eligibility boundary.

For professional and competitive examinations, official exam eligibility and blueprint rules take precedence over generic age filtering.

## India-wide language model

English is the fallback language. Indian-language packages can be published independently of board/state, but every translated package requires review.

Machine translation is never sufficient for automatic publication.

## Governance

Publication follows:

**Draft → Automated Validation → Quality Review → CEO Approval → Published → Retired**

CEO auto-approval means a configured, auditable CEO approval action executes only after all mandatory gates pass. It is not a bypass mechanism.

The audit record includes content ID, version, reviewer, approver, approval time, content hash and previous version.

## Catalog expansion

The master taxonomy includes:

- School tuition
- Government and competitive recruitment
- Banking, insurance and regulatory recruitment
- Medical, engineering, university, law, design, architecture, management, agriculture and pharmacy entrances
- CA, CMA, CS, accounting/audit, taxation, finance and other professional learning
- VATTAMS competitions

Every individual exam still requires an official-syllabus/blueprint package before its content can be marked reviewed or published.
