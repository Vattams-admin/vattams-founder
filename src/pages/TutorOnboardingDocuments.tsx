// src/pages/TutorOnboardingDocuments.tsx
//
// Part E (tutor UI): after approval, guide the tutor to upload each
// required onboarding document, show pending/verified/rejected status
// and rejection reason, and allow replacing a rejected document. Files
// are uploaded directly to private Supabase Storage via the
// tutor-onboarding-document Edge Function (src/lib/tutorOnboardingStorage.ts) —
// metadata lives in Firestore (src/lib/tutorOnboardingDocuments.ts).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import {
  REQUIRED_TUTOR_ONBOARDING_DOCUMENTS,
  type TutorOnboardingDocument,
  type TutorOnboardingDocumentType,
} from '@/types/tutorOnboarding'
import { listTutorOnboardingDocuments, saveTutorOnboardingDocumentUpload } from '@/lib/tutorOnboardingDocuments'
import {
  createTutorOnboardingDownloadUrl,
  getTutorOnboardingStoragePath,
  uploadTutorOnboardingDocument,
} from '@/lib/tutorOnboardingStorage'
import { sanitizeFilename, validateTutorDocumentFile } from '@/lib/tutorDocumentValidation'

type LoadState = 'loading' | 'loaded' | 'error' | 'not-approved'

export default function TutorOnboardingDocuments() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadState>('loading')
  const [documents, setDocuments] = useState<Partial<Record<TutorOnboardingDocumentType, TutorOnboardingDocument>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyType, setBusyType] = useState<TutorOnboardingDocumentType | null>(null)
  const [progress, setProgress] = useState<number>(0)

  async function load() {
    if (!user) return
    setState('loading')
    setError(null)
    try {
      const tutorSnap = await getDoc(doc(firestore, 'tutors', user.id))
      if (!tutorSnap.exists() || tutorSnap.data().status !== 'approved') {
        setState('not-approved')
        return
      }

      const docs = await listTutorOnboardingDocuments(user.id)
      const byType: Partial<Record<TutorOnboardingDocumentType, TutorOnboardingDocument>> = {}
      for (const d of docs) byType[d.document_type] = d
      setDocuments(byType)
      setState('loaded')
    } catch (err) {
      console.error('Failed to load onboarding documents:', err)
      setState('error')
    }
  }

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { state: { redirectTo: '/tutor/onboarding-documents' } })
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  async function handleUpload(documentType: TutorOnboardingDocumentType, file: File) {
    if (!user) return
    const validation = validateTutorDocumentFile(file)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    const existing = documents[documentType]
    const isReplacement = !!existing

    setBusyType(documentType)
    setError(null)
    setProgress(0)

    const safeFileName = sanitizeFilename(file.name)
    const storagePath = getTutorOnboardingStoragePath(user.id, documentType, safeFileName)

    try {
      const { promise } = uploadTutorOnboardingDocument(storagePath, file, setProgress)
      await promise
      await saveTutorOnboardingDocumentUpload(user.id, documentType, storagePath, safeFileName, isReplacement)
      await load()
    } catch (err) {
      console.error('Failed to upload onboarding document:', err)
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setBusyType(null)
      setProgress(0)
    }
  }

  async function handleView(documentType: TutorOnboardingDocumentType) {
    const document = documents[documentType]
    if (!document) return
    try {
      const url = await createTutorOnboardingDownloadUrl(document.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Failed to open document:', err)
      setError('Unable to open this document right now.')
    }
  }

  if (authLoading || state === 'loading') {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-slate-muted">Loading…</div>
  }

  if (state === 'not-approved') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg">Onboarding documents open up after approval</p>
        <p className="mt-2 text-sm text-slate-muted">
          Your tutor application needs to be approved (which requires the ₹500 registration payment to be verified
          first) before you can upload onboarding documents.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg text-danger">Unable to load your onboarding documents</p>
        <button onClick={load} className="btn-secondary mt-4">Retry</button>
      </div>
    )
  }

  const allVerified = REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.every((d) => documents[d.type]?.status === 'verified')

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl">Onboarding documents</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Upload each required document below. An admin will review and verify them before final onboarding.
      </p>

      {allVerified && (
        <div className="mt-4 rounded-card border border-success/40 bg-success/10 p-3 text-sm text-success">
          All documents verified — an admin can now complete your onboarding.
        </div>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-4">
        {REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.map((def) => {
          const document = documents[def.type]
          const status = document?.status ?? 'missing'
          const busy = busyType === def.type

          return (
            <div key={def.type} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{def.label}</p>
                  <p className="text-xs text-slate-muted">{def.helpText}</p>
                </div>
                <StatusPill status={status} />
              </div>

              {document && (
                <p className="mt-2 text-xs text-slate-muted">
                  {document.file_name} · uploaded {new Date(document.uploaded_at).toLocaleString('en-IN')}
                </p>
              )}

              {document?.status === 'rejected' && document.rejection_reason && (
                <p className="mt-2 rounded-card border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                  Rejected: {document.rejection_reason}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {document && document.status !== 'rejected' && (
                  <button onClick={() => handleView(def.type)} className="btn-secondary text-xs">
                    View uploaded file
                  </button>
                )}

                {(!document || document.status === 'rejected') && (
                  <label className="btn-primary cursor-pointer text-xs disabled:opacity-60">
                    {busy ? `Uploading… ${progress}%` : document ? 'Replace document' : 'Upload document'}
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) void handleUpload(def.type, file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: 'missing' | 'pending' | 'verified' | 'rejected' }) {
  const styles: Record<typeof status, string> = {
    missing: 'bg-white/10 text-slate-muted',
    pending: 'bg-gold/20 text-gold-bright',
    verified: 'bg-success/20 text-success',
    rejected: 'bg-danger/20 text-danger',
  }
  const labels: Record<typeof status, string> = {
    missing: 'Not uploaded',
    pending: 'Pending review',
    verified: 'Verified',
    rejected: 'Rejected',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
