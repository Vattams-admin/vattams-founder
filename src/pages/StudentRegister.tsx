import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'
import { friendlyAuthError } from '@/lib/authErrors'
import { createAdminBroadcast, createNotification } from '@/lib/notifications'

// Same Firebase Auth + Firestore `students` collection used by the
// existing generic Auth.tsx register flow — this page does not create a
// second authentication system, it only adds a clearer, student-specific
// form in front of the same logic, plus a `role` field so the account is
// unambiguously a student record going forward. This is also the single
// source of truth read by the admin panel (/admin/students).
export default function StudentRegister() {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  // Preserves any redirect chain handed off from a page like Payment.tsx
  // (which bounces unauthenticated students to /login with a redirectTo,
  // and /login forwards it here) — existing dashboard route is the default.
  const redirectTo =
    (location.state as { redirectTo?: string })?.redirectTo ?? '/dashboard'

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

      // Role is explicit and fixed to 'student' here — a public
      // registration form can never assign itself an admin or tutor role.
      try {
        await setDoc(doc(firestore, 'students', user.uid), {
          id: user.uid,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          email: user.email ?? email,
          role: 'student',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
      } catch (profileErr) {
        // Auth account exists but the profile write failed (e.g. offline
        // right after signup). Don't navigate away or claim registration
        // failed outright — retrying would just hit "email already in use."
        console.error('Failed to create student profile after signup:', profileErr)
        setError(
          'Your account was created, but we had trouble saving your profile. ' +
            'Please check your connection and try again.'
        )
        setSubmitting(false)
        return
      }

      // Notifications never block or fail registration — see
      // createNotification()'s doc comment in src/lib/notifications.ts.
      // Fired after the profile write succeeds (not awaited before
      // navigating) so a slow/offline notification write never delays
      // getting the student to their dashboard.
      void createNotification({
        recipient_uid: user.uid,
        recipient_role: 'student',
        type: 'registration_success',
        title: 'Welcome to VATTAMS ACADEMIA',
        message: `Your student account is ready, ${fullName.split(' ')[0] || 'there'}. Explore the course catalogue to get started.`,
        related_id: user.uid,
        related_type: 'student',
        action_url: '/courses',
      })
      void createAdminBroadcast({
        type: 'new_student_registration',
        title: 'New student registration',
        message: `${fullName || user.email || 'A new student'} just registered.`,
        related_id: user.uid,
        related_type: 'student',
        action_url: '/admin/students',
      })

      navigate(redirectTo)
    } catch (err) {
      setError(friendlyAuthError(err, 'create your account'))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">
        Join VATTAMS ACADEMIA
      </p>
      <h1 className="mt-2 font-display text-2xl">Student Registration</h1>
      <p className="mt-2 text-sm text-slate-muted">
        Create your student account to enrol in courses and track your learning.
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
          <label htmlFor="dateOfBirth" className="text-sm font-medium">
            Date of birth
          </label>
          <input
            id="dateOfBirth"
            type="date"
            required
            autoComplete="bday"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <p className="mt-1 text-xs text-slate-muted">
            Your date of birth may be used to determine eligibility for age-restricted competitions.
          </p>
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

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submitting ? 'Please wait…' : 'Create student account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-gold hover:text-gold-bright">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-muted">
        Want to teach instead?{' '}
        <Link to="/tutor/register" className="font-medium text-gold hover:text-gold-bright">
          Register as a Tutor
        </Link>
      </p>
    </div>
  )
}