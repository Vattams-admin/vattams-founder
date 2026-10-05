import { useSeo } from '@/hooks/useSeo'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'
import { friendlyAuthError } from '@/lib/authErrors'

export default function Auth({
  useSeo({ title: 'Auth', description: 'Account access', noindex: true })
  mode,
}: {
  mode: 'login' | 'register'
}) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const requestedRedirect = (location.state as { redirectTo?: unknown })?.redirectTo
  const redirectTo =
    typeof requestedRedirect === 'string' &&
    requestedRedirect.startsWith('/') &&
    !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'register') {
        if (!dateOfBirth) {
          setError('Date of birth is required.')
          setSubmitting(false)
          return
        }

        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        )

        const user = credential.user

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
          // The Firebase Auth account was created, but saving the student
          // profile failed (e.g. offline right after signup). Don't show a
          // generic "authentication failed" and don't navigate away — that
          // account now exists, so retrying registration would just hit
          // "email already in use." Stay on this page with a way forward
          // instead of silently dropping them somewhere their profile
          // doesn't exist yet.
          console.error('Failed to create student profile after signup:', profileErr)
          setError(
            'Your account was created, but we had trouble saving your profile. ' +
              'Please check your connection and try again.'
          )
          setSubmitting(false)
          return
        }

        navigate(redirectTo)
        return
      }

      await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      )

      // Authentication must not depend on a Firestore profile lookup.
      // This keeps Firebase login reliable even when Firestore is degraded.
      // Tutor users can continue directly to /tutor/dashboard; tutor/admin
      // protected routes perform their own authorization checks.
      navigate(redirectTo)
    } catch (err) {
      setError(friendlyAuthError(err, mode === 'register' ? 'create your account' : 'sign in'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="font-display text-2xl">
        {mode === 'login'
          ? 'Log in'
          : 'Create your account'}
      </h1>

      {mode === 'login' && (
        <p className="mt-2 text-sm text-slate-muted">
          Students and tutors can sign in here.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        {mode === 'register' && (
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium"
            >
              Full name
            </label>

            <input
              id="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
        )}

        {mode === 'register' && (
          <div>
            <label
              htmlFor="date-of-birth"
              className="text-sm font-medium"
            >
              Date of birth
            </label>

            <input
              id="date-of-birth"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="text-sm font-medium"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-sm font-medium"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>

        {error && (
          <p className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-60"
        >
          {submitting
            ? 'Please wait…'
            : mode === 'login'
              ? 'Log in'
              : 'Create account'}
        </button>
      </form>

      {mode === 'login' && (
        <div className="mt-6 space-y-2 text-center text-sm text-slate-muted">
          <p>
            New here?{' '}
            <Link
              to="/student/register"
              state={{ redirectTo }}
              className="font-medium text-gold hover:text-gold-bright"
            >
              Student Registration
            </Link>
          </p>
          <p>
            Want to teach?{' '}
            <Link
              to="/tutor/register"
              className="font-medium text-gold hover:text-gold-bright"
            >
              Tutor Registration
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}