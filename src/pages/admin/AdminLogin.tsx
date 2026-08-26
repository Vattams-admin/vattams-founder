import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type AuthError,
} from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { getAdminProfile } from '@/lib/adminData'
import { useAdminAuth } from '@/hooks/useAdminAuth'

// Admin identity is Firebase-only: Firebase Auth verifies the password,
// and Firestore's admin_users/{uid} document (see src/lib/adminData.ts)
// grants authorization. There is no Supabase involvement in this flow.

function friendlyFirebaseError(err: unknown): string {
  const code = (err as Partial<AuthError>)?.code

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.'
    default:
      return 'Sign in failed. Please try again.'
  }
}

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { adminUser, isAdmin, loading, profileError } = useAdminAuth()

  // A notice can arrive from AdminRoute (e.g. "please sign in", "not an
  // admin") via redirect state.
  useEffect(() => {
    const state = location.state as { notice?: string } | null
    if (state?.notice) setNotice(state.notice)
  }, [location.state])

  // Already signed in as a confirmed admin (e.g. session restored after
  // refresh) — skip the login form entirely instead of asking them to
  // sign in again.
  useEffect(() => {
    if (!loading && adminUser && isAdmin) {
      navigate('/admin/payments', { replace: true })
    }
  }, [loading, adminUser, isAdmin, navigate])

  // Session exists but we couldn't confirm admin status because of a
  // network/Supabase error — don't silently show an empty login form as
  // if they were signed out; tell them what actually happened.
  useEffect(() => {
    if (!loading && adminUser && !isAdmin && profileError) {
      setNotice(null)
      setError('Unable to connect right now. Please check your internet connection and try again.')
    }
  }, [loading, adminUser, isAdmin, profileError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setSubmitting(true)

    let credentialUser: Awaited<ReturnType<typeof signInWithEmailAndPassword>>['user'] | null = null

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      )
      credentialUser = credential.user
    } catch (err) {
      // Real Firebase Auth failure (bad password, unknown email, etc.) —
      // the account was never signed in, so there's nothing to roll back.
      console.error('Admin login: Firebase sign-in failed.', err)
      setError(friendlyFirebaseError(err))
      setSubmitting(false)
      return
    }

    if (!credentialUser) {
      // Unreachable in practice (the catch above always returns), but
      // keeps credentialUser.email below from being used unnarrowed.
      setSubmitting(false)
      return
    }

    try {
      // Membership in the admin_users/{uid} Firestore document (active +
      // a valid admin role) is what grants admin access — not merely
      // having a Firebase account. Look up by the uid Firebase just
      // verified.
      const profile = await getAdminProfile(credentialUser.uid)
      if (!profile) {
        await firebaseSignOut(firebaseAuth)
        setError('This account does not have admin access.')
        setSubmitting(false)
        return
      }

      navigate('/admin/dashboard')
    } catch (err) {
      // Firebase login succeeded, but confirming admin status against
      // Firestore failed (offline, security rules blocking the read,
      // etc.). This is not "wrong password" and not "not an admin" —
      // it's a connection problem, so say that plainly without exposing
      // internal error details on screen. Full details go to the
      // console for support.
      console.error('Admin login: signed in to Firebase, but the admin_users lookup failed.', err)
      await firebaseSignOut(firebaseAuth).catch(() => {})
      setError('Signed in, but unable to verify admin access right now. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-20 sm:px-6">
      <h1 className="font-display text-2xl">Admin sign in</h1>

      {notice && (
        <p role="status" className="mt-4 text-sm text-gold">
          {notice}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold disabled:opacity-60"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
          {submitting ? 'Please wait…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}