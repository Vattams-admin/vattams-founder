# VATTAMS Academia — Complete India-Wide Platform Architecture

## Purpose

This document defines the canonical product taxonomy for VATTAMS Academia. It separates school curricula, government/competitive examinations, entrance examinations, professional qualifications, and VATTAMS competitions while using one production content and assessment runtime.

## School Tuition

School content begins at Class 1 and runs through Class 12.

### Curriculum spaces

- CBSE
- ICSE
- ISC
- NIOS
- State / UT Boards
- Matriculation / state-specific private curricula
- International Baccalaureate
- Cambridge International
- Pearson Edexcel

Every state/UT board is its own curriculum namespace. A chapter, lesson, question or assessment is never assumed to be equivalent across boards without explicit mapping and review.

### Content package

Each lesson can contain:

1. syllabus alignment
2. complete lesson notes
3. concepts and definitions
4. worked examples
5. visual/diagram references where appropriate
6. basic practice
7. conceptual practice
8. application/HOTS practice
9. common mistakes
10. key takeaways
11. flash recall
12. formula/fact bank where applicable
13. chapter revision
14. weak-topic revision
15. chapter/subject/mock assessments

## Question and assessment runtime

### Practice

After submission, the learner can receive:

- correct answer
- detailed reasoning
- explanation of why the selected option is correct
- why other options are incorrect where appropriate
- underlying concept
- revision recommendation

### Official assessment

During the attempt the learner receives only:

- question
- exactly four options

The correct answer and explanation remain private until the configured result-release policy permits disclosure.

Question selection is:

1. curriculum eligibility
2. class/exam eligibility
3. age-band eligibility
4. assessment blueprint
5. difficulty distribution
6. topic distribution
7. recent-repetition exclusion
8. student-specific question order
9. option randomization

## Age adaptation

Age is not used to alter a syllabus incorrectly. Curriculum/class/exam eligibility is evaluated first. Age suitability is then applied to select an appropriate question pool, language complexity and presentation level.

## Competitive exams

The platform taxonomy supports:

- UPSC
- SSC
- Banking and financial recruitment
- Railways
- TNPSC
- State PSC / state recruitment
- Defence and uniformed services
- Teacher eligibility/recruitment
- other government/public-sector recruitment

Each exam gets its own versioned syllabus, blueprint, study materials, PYQ layer, practice, sectional tests, mocks, revision and answer-explanation package.

## Entrance exams

The architecture includes:

- Medical and allied health
- Engineering and technology
- University entrance
- Law
- Management
- Design/fashion
- Architecture/planning
- Agriculture
- Hotel management
- Research/science

Examples include NEET-UG, JEE Main/Advanced, CUET, CLAT/AILET, CAT/XAT/CMAT/MAT, NIFT/NID/UCEED/CEED, NATA, NCHM-JEE, and research examinations. Actual eligibility and syllabus remain versioned against the applicable official authority.

## Professional education

Professional content includes:

- Chartered Accountancy — Foundation, Intermediate, Final
- Cost and Management Accountancy — Foundation, Intermediate, Final
- Company Secretary — CSEET, Executive, Professional
- Audit and Assurance
- Finance and Accounting
- extensible professional qualification slots

CA content specifically supports accounting, taxation, law, audit/assurance, financial reporting, financial management and strategic management.

## Competitions

Thirukkural Mastery Championship remains the reference implementation.

The standard experience is:

Study Materials → Topic Learning → Practice → Mock Test → Revision → Age Group / Eligibility → Official Attempt → Result → Certificate

## Multilingual India

The language layer is independent of curriculum and state. A learner may use an eligible curriculum in its original language or a reviewed translation.

Translation rules:

- English fallback is available.
- Translated content is separately versioned.
- Machine translation cannot auto-publish.
- Language review is required before publication.
- Official answer keys remain private.

## Governance

Content lifecycle:

Draft → Automated Validation → Quality Review → CEO Approval → Published → Retired

CEO approval is a configured, auditable workflow rather than an uncontrolled automatic publish.

Each published package records:

- content ID
- version
- approver
- approval timestamp
- content hash
- previous version

## Production rule

No placeholder/template question may become production assessment content. A package becomes publishable only after its required evidence, question quality, answer key, language and governance gates pass.

The existing Thirukkural production package is the reference for competition runtime quality; the same principles apply to school, competitive-exam, entrance and professional packages.
