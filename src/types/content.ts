export type ContentDomain = 'school' | 'competitive-exam' | 'entrance-exam' | 'professional' | 'competition'

export type ContentStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'retired'

export type AssessmentMode =
  | 'practice'
  | 'topic_test'
  | 'chapter_test'
  | 'subject_test'
  | 'sectional_test'
  | 'mock_test'
  | 'official_attempt'

export interface ContentLocator {
  domain: ContentDomain
  stateOrUt?: string
  curriculum?: string
  boardOrCurriculum?: string
  classNumber?: number
  subject?: string
  chapter?: string
  topic?: string
  subtopic?: string
  examFamily?: string
  exam?: string
  course?: string
  competition?: string
  language: string
  ageBand?: string
}

export interface StudyMaterialPackage {
  contentId: string
  version: number
  locator: ContentLocator
  title: string
  objectives: string[]
  concepts: string[]
  definitions?: string[]
  workedExamples?: string[]
  commonMistakes?: string[]
  keyTakeaways?: string[]
  revisionPoints?: string[]
  practiceLayers?: {
    basic?: string[]
    conceptual?: string[]
    application?: string[]
    higherOrderThinking?: string[]
    mixedReview?: string[]
  }
  revisionLayers?: {
    quickRevision?: string[]
    flashRecall?: string[]
    formulaOrFactBank?: string[]
    mistakeBasedRevision?: string[]
    weakTopicRevision?: string[]
  }
  status: ContentStatus
  source?: string
  contentHash?: string
  previousVersion?: string
  approvedBy?: string
  approvedAt?: string
}

export interface ObjectiveQuestion {
  questionId: string
  contentId: string
  locator: ContentLocator
  question: string
  options: [string, string, string, string]
  difficulty: 'easy' | 'medium' | 'hard'
  questionType: 'mcq'
  marks: number
  timeSeconds: number
  ageBand?: string
  source?: string
  provenance?: string
  version?: number
  reviewStatus: 'reviewed'
}

export interface PrivateAnswerKey {
  questionId: string
  correctOptionIndex: 0 | 1 | 2 | 3
  explanation: string
  distractorExplanations?: [string, string, string, string]
  concept?: string
  remediation?: string
  reviewStatus: 'reviewed'
}

export interface AssessmentPackage {
  assessmentId: string
  version: number
  domain: ContentDomain
  locator: ContentLocator
  mode: AssessmentMode
  title: string
  questionCount: number
  timeSeconds: number
  publicQuestionIds: string[]
  answerReleasePolicy: 'immediate_practice' | 'after_submission' | 'scheduled' | 'never'
  status: ContentStatus
  approvedBy?: string
  approvedAt?: string
}
