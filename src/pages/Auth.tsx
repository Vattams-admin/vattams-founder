import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'

export default function Auth({
  mode,
}: {
  mode: 'login' | 'register'
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo =
    (location.state as { redirectTo?: string })?.redirectTo ??
    '/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email,
          password
        )

        const user = credential.user

        await setDoc(doc(firestore, 'students', user.uid), {
          id: user.uid,
          full_name: fullName,
          email: user.email ?? email,
          created_at: new Date().toISOString(),
        })

        navigate(redirectTo)
        return
      }

      await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      )

      navigate(redirectTo)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Authentication failed. Please try again.')
      }
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
    </div>
  )
}
