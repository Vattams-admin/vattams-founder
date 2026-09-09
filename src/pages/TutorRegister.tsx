import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'
import { friendlyAuthError } from '@/lib/authErrors'
import { createAdminBroadcast } from '@/lib/notifications'
import {
  saveTutorOnboardingDocumentUpload,
} from '@/lib/tutorOnboardingDocuments'
import {
  getTutorOnboardingStoragePath,
  uploadTutorOnboardingDocument,
} from '@/lib/tutorOnboardingStorage'
import {
  sanitizeFilename,
  validateTutorDocumentFile,
} from '@/lib/tutorDocumentValidation'
import {
  OPTIONAL_TUTOR_ONBOARDING_DOCUMENTS,
  REQUIRED_TUTOR_ONBOARDING_DOCUMENTS,
} from '@/types/tutorOnboarding'
import type { TutorOnboardingDocumentType } from '@/types/tutorOnboarding'

// Firebase Auth + a `tutors` Firestore collection, mirroring the
// existing student registration pattern (Auth.tsx) — role fixed to
// 'tutor' and status starts at pending_approval. This is the single
// source of truth for tutor applications; the admin panel
// (/admin/tutors) reads directly from this same collection.
export default function TutorRegister() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [qualification, setQualification] = useState('')
  const [expertise, setExpertise] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [selectedDocuments, setSelectedDocuments] = useState<
    Partial<Record<TutorOnboardingDocumentType, File>>
  >({})
  const [uploadProgress, setUploadProgress] = useState<
    Partial<Record<TutorOnboardingDocumentType, number>>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleDocumentChange(
    documentType: TutorOnboardingDocumentType,
    file: File | undefined
  ) {
    if (!file) return

    const validation = validateTutorDocumentFile(file)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    setError(null)
    setSelectedDocuments((current) => ({
      ...current,
      [documentType]: file,
    }))
    setUploadProgress((current) => ({
      ...current,
      [documentType]: 0,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const missingDocuments = REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.filter(
      (document) => !selectedDocuments[document.type]
    )

    if (missingDocuments.length > 0) {
      setError(
        `Please upload all required documents: ${missingDocuments
          .map((document) => document.label)
          .join(', ')}.`
      )
      return
    }

    setSubmitting(true)

    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      )

      const user = credential.user

      // Role is explicit and fixed to 'tutor' — never selectable by the
      // person filling out the form. status starts at pending_approval
      // since there is no existing tutor-approval system to defer to.
      try {
        await setDoc(doc(firestore, 'tutors', user.uid), {
          id: user.uid,
          full_name: fullName,
          email: user.email ?? email,
          qualification,
          expertise,
          introduction,
          role: 'tutor',
          status: 'pending_approval',
          created_at: new Date().toISOString(),
        })
      } catch (profileErr) {
        // Auth account exists but the profile write failed (e.g. offline
        // right after signup). Don't claim registration failed outright —
        // retrying would just hit "email already in use."
        console.error('Failed to create tutor profile after signup:', profileErr)
        setError(
          'Your account was created, but we had trouble saving your application. ' +
            'Please check your connection and try again.'
        )
        setSubmitting(false)
        return
      }

      // Upload the selected onboarding documents to the private
      // Supabase Storage bucket and persist only their metadata in
      // Firestore. The Firebase user now exists, so the upload service
      // can authenticate the owning tutor securely.
      const documentsToUpload = [
        ...REQUIRED_TUTOR_ONBOARDING_DOCUMENTS,
        ...OPTIONAL_TUTOR_ONBOARDING_DOCUMENTS,
      ]

      for (const document of documentsToUpload) {
        const file = selectedDocuments[document.type]
        if (!file) continue

        const safeFileName = sanitizeFilename(file.name)
        const storagePath = getTutorOnboardingStoragePath(
          user.uid,
          document.type,
          safeFileName
        )

        setUploadProgress((current) => ({
          ...current,
          [document.type]: 0,
        }))

        const upload = uploadTutorOnboardingDocument(
          storagePath,
          file,
          (percent) =>
            setUploadProgress((current) => ({
              ...current,
              [document.type]: percent,
            }))
        )

        try {
          await upload.promise
          await saveTutorOnboardingDocumentUpload(
            user.uid,
            document.type,
            storagePath,
            safeFileName,
            false
          )
        } catch (uploadErr) {
          upload.cancel()
          const message =
            uploadErr instanceof Error
              ? uploadErr.message
              : 'Unknown upload error'

          setError(
            `Your account was created, but we could not upload your ${document.label}. ${message} Please check the file and try again.`
          )
          setSubmitting(false)
          return
        }
      }

      // No TUTOR notification type fits "your own application was
      // received" (the spec's TUTOR type list has no registration_success
      // equivalent), and a pending tutor has nowhere to see it yet (no
      // tutor portal exists — see delivery report), so only the admin
      // side is notified here. Never blocks or fails the application
      // (see createNotification() in src/lib/notifications.ts).
      void createAdminBroadcast({
        type: 'tutor_activity',
        title: 'New tutor application',
        message: `${fullName || user.email || 'A new tutor'} applied to teach (${expertise || 'subject not specified'}).`,
        related_id: user.uid,
        related_type: 'tutor',
        action_url: '/admin/tutors',
      })

      setSubmitted(true)
      setSubmitting(false)
    } catch (err) {
      setError(friendlyAuthError(err, 'create your account'))
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl">Application received</h1>
        <p className="mt-3 text-sm text-slate-muted">
          Thanks for applying to teach at VATTAMS ACADEMIA. Next, complete your ₹500 registration payment — your
          application will be reviewed for approval once it&apos;s verified.
        </p>
        <Link to="/tutor/pay" className="btn-primary mt-6 inline-flex">
          Pay ₹500 registration fee
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
        Teach at VATTAMS ACADEMIA
      </p>
      <h1 className="mt-2 font-display text-2xl">Tutor Registration</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Apply to become a tutor. Your account will be reviewed before you can
        start teaching.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Full name
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="qualification" className="text-sm font-medium">
            Qualification
          </label>
          <input
            id="qualification"
            required
            placeholder="e.g. M.A. English, B.Ed"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="expertise" className="text-sm font-medium">
            Subject / expertise
          </label>
          <input
            id="expertise"
            required
            placeholder="e.g. Public Speaking, Mathematics"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label htmlFor="introduction" className="text-sm font-medium">
            Short introduction
          </label>
          <textarea
            id="introduction"
            required
            rows={4}
            placeholder="Tell us a bit about your teaching experience"
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <h2 className="font-display text-lg">Required documents</h2>
            <p className="mt-1 text-xs text-slate-muted">
              Please upload all 5 required documents. PDF, PNG, JPG, or WEBP up to 10 MB each.
            </p>
          </div>

          {REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.map((document) => {
            const file = selectedDocuments[document.type]
            const progress = uploadProgress[document.type]

            return (
              <div
                key={document.type}
                className="rounded-card border border-white/10 bg-ink/60 p-3"
              >
                <label
                  htmlFor={`document-${document.type}`}
                  className="text-sm font-medium"
                >
                  {document.label} <span className="text-danger">*</span>
                </label>
                <p className="mt-1 text-xs text-slate-muted">{document.helpText}</p>
                <input
                  id={`document-${document.type}`}
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    handleDocumentChange(document.type, e.target.files?.[0])
                  }
                  className="mt-2 block w-full text-xs"
                />
                {file && (
                  <div className="mt-2 text-xs text-slate-muted">
                    <p className="truncate">{file.name}</p>
                    {typeof progress === 'number' && progress > 0 && progress < 100 && (
                      <p className="mt-1">Uploading: {progress}%</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div className="pt-2">
            <h2 className="font-display text-lg">Optional documents</h2>
            <p className="mt-1 text-xs text-slate-muted">
              These can strengthen your application but are not mandatory.
            </p>
          </div>

          {OPTIONAL_TUTOR_ONBOARDING_DOCUMENTS.map((document) => {
            const file = selectedDocuments[document.type]
            const progress = uploadProgress[document.type]

            return (
              <div
                key={document.type}
                className="rounded-card border border-white/10 bg-ink/60 p-3"
              >
                <label
                  htmlFor={`document-${document.type}`}
                  className="text-sm font-medium"
                >
                  {document.label}
                </label>
                <p className="mt-1 text-xs text-slate-muted">{document.helpText}</p>
                <input
                  id={`document-${document.type}`}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    handleDocumentChange(document.type, e.target.files?.[0])
                  }
                  className="mt-2 block w-full text-xs"
                />
                {file && (
                  <div className="mt-2 text-xs text-slate-muted">
                    <p className="truncate">{file.name}</p>
                    {typeof progress === 'number' && progress > 0 && progress < 100 && (
                      <p className="mt-1">Uploading: {progress}%</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : 'Submit application'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-gold hover:text-gold-bright">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-muted">
        Want to learn instead?{' '}
        <Link to="/student/register" className="font-medium text-gold hover:text-gold-bright">
          Register as a Student
        </Link>
      </p>
    </div>
  )
}