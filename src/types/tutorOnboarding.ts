// src/types/tutorOnboarding.ts
//
// No existing tutor document fields, types, or storage helpers were
// found anywhere in this codebase (searched src/types, src/lib,
// src/pages, src/components) — this is a new, additive module. The
// required document set below is the single source of truth used by:
//   - src/pages/TutorOnboardingDocuments.tsx (tutor upload UI)
//   - src/pages/admin/AdminTutors.tsx (admin review UI)
//   - src/lib/onboarding.ts (the onboarding gate — ALL of these must
//     be 'verified' before onboardTutor() can mint an Employee Code)
//
// Each document type is also the deterministic Firestore doc id under
// tutors/{tutorId}/onboarding_documents/{documentType} — one document
// per type, so re-uploading always replaces/updates the same doc
// instead of accumulating duplicates.

export type TutorOnboardingDocumentType =
  | 'government_id'
  | 'qualification_certificate'
  | 'address_proof'
  | 'bank_proof'

export type TutorOnboardingDocumentStatus = 'pending' | 'verified' | 'rejected'

export interface TutorOnboardingDocumentDefinition {
  type: TutorOnboardingDocumentType
  label: string
  helpText: string
}

export const REQUIRED_TUTOR_ONBOARDING_DOCUMENTS: TutorOnboardingDocumentDefinition[] = [
  {
    type: 'government_id',
    label: 'Government-issued photo ID',
    helpText: 'Aadhaar, PAN, passport, voter ID, or driving licence.',
  },
  {
    type: 'qualification_certificate',
    label: 'Highest qualification certificate',
    helpText: 'Degree or diploma certificate matching your registration details.',
  },
  {
    type: 'address_proof',
    label: 'Address proof',
    helpText: 'Utility bill, bank statement, or Aadhaar showing your current address.',
  },
  {
    type: 'bank_proof',
    label: 'Bank account proof',
    helpText: 'Cancelled cheque or bank passbook first page, for payouts.',
  },
]

export const REQUIRED_TUTOR_ONBOARDING_DOCUMENT_TYPES: TutorOnboardingDocumentType[] =
  REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.map((d) => d.type)

export interface TutorOnboardingDocument {
  id: string
  tutor_id: string
  document_type: TutorOnboardingDocumentType
  storage_path: string
  file_name: string
  status: TutorOnboardingDocumentStatus
  uploaded_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
}
