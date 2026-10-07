# VATTAMS Academia — Universal India Platform Blueprint

## 1. Platform segmentation

VATTAMS Academia is organized as independent, addressable content namespaces rather than one mixed course catalogue.

### School Tuition
- State / UT Board
- Matriculation / state-specific private curriculum
- CBSE
- CISCE: ICSE / ISC
- NIOS
- International schools: IB, Cambridge International, Pearson Edexcel
- Classes 1–12
- Every class is independently segmented by subject, chapter, topic, subtopic and language.

### Competitive examinations
- TNPSC and other State PSC/recruitment
- UPSC
- SSC
- Banking and financial recruitment
- Railways
- Defence / uniformed services
- State government recruitment

### Entrance examinations
- Medical: NEET and other medical entrance pathways
- Engineering: JEE and state engineering entrances
- University: CUET and other university entrances
- Law: CLAT/AILET and other law entrances
- Design: NIFT/UCEED/NID-DAT and related pathways
- Architecture: NATA/JEE Architecture
- Agriculture
- Pharmacy
- Nursing / allied health / paramedical
- Management: CAT/XAT/CMAT/MAT and related pathways
- Hotel management
- Teacher education: CTET/TET and related pathways
- Fine arts / media / creative entrances

### Professional education
- CA Foundation / Intermediate / Final
- CA Auditing
- CMA
- CS
- ACCA and other accounting/finance qualifications
- Professional medicine
- Law
- Engineering/professional engineering
- IT, cloud, cybersecurity, data/AI
- Education and continuing professional development
- Extensible certification pathways

### VATTAMS Competitions
- Thirukkural Mastery Championship as the reference implementation
- Every competition follows the same study → practice → mock → revision → official attempt → result → certificate lifecycle
- Age-group adaptation is applied after curriculum/competition eligibility.

## 2. Universal learning package

Every production lesson package is designed to support:

1. Learning objectives
2. Complete lesson notes
3. Concepts and definitions
4. Worked examples
5. Visual explanations where useful
6. Common mistakes
7. Key takeaways
8. Basic practice
9. Conceptual practice
10. Application questions
11. HOTS questions
12. Mixed review
13. Quick revision
14. Flash recall
15. Formula/fact bank where applicable
16. Mistake-based revision
17. Weak-topic remediation
18. Topic/chapter/subject/sectional/full mock assessments

## 3. Question and assessment standard

Objective questions use exactly four unique options.

### Practice/review
After submission, the student can receive:
- selected answer
- correct answer
- reasoning
- why distractors are wrong
- underlying concept
- remediation/revision recommendation

### Official attempt
During the official attempt, the student receives only:
- question
- four options
- permitted metadata such as difficulty/marks/time where applicable

Correct answers and explanations remain private until the configured result-release policy.

### Randomization
The assessment engine must:
- select only eligible curriculum content
- apply class/age eligibility
- respect blueprint topic distribution
- control difficulty distribution
- shuffle options
- create student-specific question order
- avoid recent repetition
- preserve official answer-key mapping server-side

## 4. Multilingual architecture

Language is an independent content dimension.

The same curriculum namespace can have English, scheduled Indian language versions, and additional supported language versions as the platform expands.

A translation is a versioned content asset and requires review. Machine translation may assist drafting but cannot publish official content automatically.

## 5. Governance

Draft → Automated Validation → Quality Review → CEO Approval → Published → Retired

Automatic CEO approval means a configured CEO governance action can approve a package after every mandatory gate passes. It must remain auditable and must never bypass schema validation, source evidence, question-quality checks, private answer-key protection, review status, content hash or audit record.

## 6. Production principle

The taxonomy defines what the platform can support. It does not falsely claim that every syllabus, chapter, question bank or translation has already been authored.

Actual content becomes production-ready only after its own package, evidence, validation, review and approval gates pass.

Thirukkural Mastery Championship remains the benchmark for competition runtime quality. The same production principles are being generalized across school, competitive-exam, entrance-exam and professional content.
