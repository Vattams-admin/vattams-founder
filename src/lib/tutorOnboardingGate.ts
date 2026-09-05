// src/lib/tutorOnboardingGate.ts
//
// UI-facing readiness check ONLY — this does not enforce anything by
// itself. The actual gate is enforced twice, independent of this file:
//   1. src/lib/onboarding.ts's onboardTutor() re-checks payment +
//      documents inside the same Firestore transaction that mints the
//      Employee Code/Tutor ID.
//   2. firestore.rules' tutorApprovalGateOk() blocks status:'approved'
//      writes without a verified payment.
// This module exists purely so AdminTutors.tsx can show a specific,
// helpful "why is Onboard disabled" message without guessing — per the
// task spec's "clear reason when Onboard is blocked".

import { getTutorRegistrationPayment } from '@/lib/tutorPayments'
import { listTutorOnboardingDocuments } from '@/lib/tutorOnboardingDocuments'
import {
  REQUIRED_TUTOR_ONBOARDING_DOCUMENTS,
  type TutorOnboardingDocument,
  type TutorOnboardingDocumentType,
} from '@/types/tutorOnboarding'

export interface TutorOnboardingReadiness {
  paymentVerified: boolean
  documentsByType: Partial<Record<TutorOnboardingDocumentType, TutorOnboardingDocument>>
  allDocumentsVerified: boolean
  canOnboard: boolean
  blockedReasons: string[]
}

export async function getTutorOnboardingReadiness(
  tutorId: string,
  tutorStatus: string | null
): Promise<TutorOnboardingReadiness> {
  const [payment, documents] = await Promise.all([
    getTutorRegistrationPayment(tutorId),
    listTutorOnboardingDocuments(tutorId),
  ])

  const paymentVerified = payment?.status === 'approved'

  const documentsByType: Partial<Record<TutorOnboardingDocumentType, TutorOnboardingDocument>> = {}
  for (const document of documents) {
    documentsByType[document.document_type] = document
  }

  const allDocumentsVerified = REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.every(
    (def) => documentsByType[def.type]?.status === 'verified'
  )

  const blockedReasons: string[] = []
  if (tutorStatus !== 'approved') {
    blockedReasons.push('Tutor application is not yet approved.')
  }
  if (!paymentVerified) {
    blockedReasons.push('₹500 registration payment is not yet verified.')
  }
  if (!allDocumentsVerified) {
    const missing = REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.filter(
      (def) => documentsByType[def.type]?.status !== 'verified'
    ).map((def) => def.label)
    blockedReasons.push(`Documents not yet verified: ${missing.join(', ')}.`)
  }

  return {
    paymentVerified,
    documentsByType,
    allDocumentsVerified,
    canOnboard: tutorStatus === 'approved' && paymentVerified && allDocumentsVerified,
    blockedReasons,
  }
}
