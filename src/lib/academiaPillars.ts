/**
 * VATTAMS ACADEMIA — platform information architecture.
 *
 * This is presentation/discovery metadata, not a replacement for the
 * persisted Firestore course category IDs. Keep existing course, payment,
 * enrolment, assessment and competition flows unchanged while the catalogue
 * grows into the three-pillar model.
 */

export type AcademiaPillarId = 'courses' | 'exam-preparation' | 'competitions'

export interface AcademiaPillar {
  id: AcademiaPillarId
  number: '01' | '02' | '03'
  title: string
  summary: string
  route: string
  focusAreas: readonly string[]
  suggestedTopics: readonly string[]
}

export const ACADEMIA_PILLARS: readonly AcademiaPillar[] = [
  {
    id: 'courses',
    number: '01',
    title: 'Courses & Learning',
    summary:
      'Structured learning journeys from early foundations through school, higher education, professional skills and certification.',
    route: '/courses',
    focusAreas: [
      'Early learning & phonics',
      'School curricula & boards',
      'Languages & communication',
      'Diploma, college & university',
      'Professional skills & certifications',
    ],
    suggestedTopics: [
      'Phonics, reading fluency and foundational numeracy',
      'Class-wise CBSE, ICSE and Indian state-board learning',
      'Tamil and other Indian-language learning',
      'Engineering, medical and allied-health foundations',
      'Accounting, auditing and professional certification',
      'Programming, digital literacy and career skills',
    ],
  },
  {
    id: 'exam-preparation',
    number: '02',
    title: 'Competitive & Entrance Exams',
    summary:
      'Exam-specific preparation built around syllabus maps, authored study material, question banks, practice and timed mock assessments.',
    route: '/competitive-exams',
    focusAreas: [
      'Government & recruitment exams',
      'Engineering & medical entrance',
      'University & postgraduate entrance',
      'Law, management & pharmacy',
      'Professional qualification exams',
    ],
    suggestedTopics: [
      'TNPSC, UPSC, SSC and state recruitment',
      'Banking, railways, police and defence',
      'JEE, NEET and architecture entrance',
      'CUET and university entrance pathways',
      'Law, management, agriculture and polytechnic entrance',
      'CA, accounting, auditing and other professional pathways',
    ],
  },
  {
    id: 'competitions',
    number: '03',
    title: 'Competitions & Olympiads',
    summary:
      'Self-learning competition journeys with dedicated study materials, question banks, mock practice, official attempts and result pathways.',
    route: '/competitions',
    focusAreas: [
      'Subject Olympiads',
      'Mathematics & science challenges',
      'Language & literature',
      'Knowledge, reasoning & interdisciplinary',
      'School and open championships',
    ],
    suggestedTopics: [
      'Thirukkural and Indian classical literature',
      'Indian languages and literary knowledge',
      'Mathematics, science and logical reasoning',
      'General knowledge and current awareness',
      'Technology and interdisciplinary challenges',
      'Age-appropriate school-level Olympiads',
    ],
  },
] as const

/** Cross-pillar capabilities to plan for without claiming they are live yet. */
export const ACADEMIA_PLATFORM_EXTENSIONS = [
  {
    id: 'language-learning',
    title: 'Language Learning',
    summary: 'Listening, speaking, reading and writing pathways for Indian and global languages.',
  },
  {
    id: 'personalised-practice',
    title: 'Personalised Practice',
    summary: 'Use assessment evidence to recommend revision and the next best practice activity.',
  },
  {
    id: 'accessible-learning',
    title: 'Accessible Learning',
    summary: 'Mobile-first layouts, readable content, keyboard access and reduced-motion support.',
  },
  {
    id: 'learning-progress',
    title: 'Learning Progress',
    summary: 'Clear learner progress across lessons, practice, assessments and eligible certificates.',
  },
] as const
