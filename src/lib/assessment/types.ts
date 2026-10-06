export type AssessmentDomain = 'competition' | 'competitive-exam' | 'tuition'

export type AssessmentKind =
  | 'topic_practice'
  | 'sectional_test'
  | 'pyq_test'
  | 'mock_test'
  | 'official_attempt'
  | 'chapter_test'
  | 'subject_test'

export type AssessmentQuestionType = 'multiple_choice'

export type AssessmentStatus = 'draft' | 'reviewed' | 'published' | 'retired'

export interface AssessmentQuestionPublic {
  question_id: string
  question: string
  options: [string, string, string, string]
  domain: AssessmentDomain
  course_id: string
  assessment_id: string
  subject: string
  topic: string
  subtopic: string
  difficulty: 'easy' | 'medium' | 'hard'
  language: string
  marks: number
  time_seconds: number
}

export interface AssessmentQuestion extends AssessmentQuestionPublic {
  correct_option_index: 0 | 1 | 2 | 3
  explanation: string
  review_status: 'reviewed'
}

export interface AssessmentDefinition {
  assessment_id: string
  course_id: string
  slug: string
  title: string
  domain: AssessmentDomain
  kind: AssessmentKind
  status: AssessmentStatus
  question_bank_public: string
  answer_key: string
  question_count: number
  time_seconds: number
  pass_percent?: number
  section_blueprint?: Record<string, number>
}

export interface AssessmentRegistry {
  version: 1
  assessments: Record<string, AssessmentDefinition>
}
