// src/lib/tutorOnboardingDocuments.ts
//
// Firestore metadata for tutor onboarding documents. The actual file
// bytes are private Supabase Storage objects (see
// src/lib/tutorOnboardingStorage.ts) — this module only manages the
// tutors/{tutorId}/onboarding_documents/{documentType} metadata docs
// (see src/types/tutorOnboarding.ts and the matching Firestore rules).

import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { TutorOnboardingDocument, TutorOnboardingDocumentType } from '@/types/tutorOnboarding'
import { createNotification, createAdminBroadcast } from '@/lib/notifications'

function docsCollection(tutorId: string) {
  return collection(firestore, 'tutors', tutorId, 'onboarding_documents')
}

function docRef(tutorId: string, documentType: TutorOnboardingDocumentType) {
  return doc(firestore, 'tutors', tutorId, 'onboarding_documents', documentType)
}

export async function listTutorOnboardingDocuments(tutorId: string): Promise<TutorOnboardingDocument[]> {
  const snapshot = await getDocs(docsCollection(tutorId))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as TutorOnboardingDocument[]
}

export async function getTutorOnboardingDocument(
  tutorId: string,
  documentType: TutorOnboardingDocumentType
): Promise<TutorOnboardingDocument | null> {
  const snap = await getDoc(docRef(tutorId, documentType))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as TutorOnboardingDocument
}

/**
 * Tutor uploads (or replaces, after a rejection) one required document.
 * Always resets status to 'pending' and clears any prior rejection —
 * matches the Firestore rule, which only allows a tutor to write a
 * fresh 'pending' doc or replace a 'rejected' one back to 'pending'.
 */
export async function saveTutorOnboardingDocumentUpload(
  tutorId: string,
  documentType: TutorOnboardingDocumentType,
  storagePath: string,
  fileName: string,
  isReplacement: boolean
): Promise<void> {
  const ref = docRef(tutorId, documentType)
  const payload = {
    tutor_id: tutorId,
    document_type: documentType,
    storage_path: storagePath,
    file_name: fileName,
    status: 'pending' as const,
    uploaded_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  }

  if (isReplacement) {
    await updateDoc(ref, payload)
  } else {
    await setDoc(ref, payload)
  }

  void createAdminBroadcast({
    type: 'tutor_activity',
    title: 'Tutor onboarding document uploaded',
    message: `A tutor uploaded a document for review (${documentType.replace(/_/g, ' ')}).`,
    related_id: tutorId,
    related_type: 'tutor',
    action_url: '/admin/tutors',
  })
}

export interface ReviewResult {
  error: string | null
}

/** Admin marks a document VERIFIED or REJECTED (rejection requires a reason). */
export async function reviewTutorOnboardingDocument(
  tutorId: string,
  documentType: TutorOnboardingDocumentType,
  status: 'verified' | 'rejected',
  adminIdentifier: string,
  rejectionReason: string | null
): Promise<ReviewResult> {
  try {
    await updateDoc(docRef(tutorId, documentType), {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminIdentifier,
      rejection_reason: status === 'rejected' ? rejectionReason : null,
    })

    void createNotification({
      recipient_uid: tutorId,
      recipient_role: 'tutor',
      type: 'tutor_document_status',
      title: status === 'verified' ? 'Onboarding document verified' : 'Onboarding document rejected',
      message:
        status === 'verified'
          ? `Your ${documentType.replace(/_/g, ' ')} document has been verified.`
          : `Your ${documentType.replace(/_/g, ' ')} document was rejected${rejectionReason ? `: ${rejectionReason}` : '.'} Please upload a replacement.`,
      related_id: tutorId,
      related_type: 'tutor_onboarding_document',
      action_url: '/tutor/onboarding-documents',
    })

    return { error: null }
  } catch (error) {
    console.error('Failed to review tutor onboarding document:', error)
    return { error: 'Unable to save this review right now. Please check your connection and try again.' }
  }
}
