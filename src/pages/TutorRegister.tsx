import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'

// No tutor collection, tutor role, or tutor approval flow exists anywhere
// in this project yet — so this page follows the same Firebase Auth +
// Firestore pattern as the existing student registration (Auth.tsx),
// writing to a sibling `tutors` collection instead of `students`, with a
// role and a pending-approval status. This is the same authentication
// system the project already uses, applied consistently — not a second
// backend.
export default function TutorRegister() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [qualification, setQualification] = useState('')
  const [expertise, setExpertise] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
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

      setSubmitted(true)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-2xl">Application received</h1>
        <p className="mt-3 text-sm text-slate-muted">
          Thanks for applying to teach at VATTAMS ACADEMIA. Your tutor account is
          pending review — we&apos;ll notify you at {email} once it&apos;s approved.
        </p>
        <Link to="/" className="btn-secondary mt-6 inline-flex">
          Back to home
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
