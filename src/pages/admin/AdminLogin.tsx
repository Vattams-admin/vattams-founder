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

type AdminLoginLocationState = {
  notice?: string
  redirectTo?: string
}

function getAdminReturnPath(state: AdminLoginLocationState | null): string {
  const redirectTo = state?.redirectTo
  // Only honor internal admin destinations. This prevents auth state from
  // becoming an open redirect while preserving pathname + query + hash.
  if (
    typeof redirectTo === 'string' &&
    redirectTo.startsWith('/admin/') &&
    !redirectTo.startsWith('/admin/login')
  ) {
    return redirectTo
  }

  return '/admin/dashboard'
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
  const locationState = (location.state as AdminLoginLocationState | null) ?? null
  const returnPath = getAdminReturnPath(locationState)

  // A notice can arrive from AdminRoute (e.g. "please sign in", "not an
  // admin") via redirect state.
  useEffect(() => {
    if (locationState?.notice) setNotice(locationState.notice)
  }, [locationState?.notice])

  // Already signed in as a confirmed admin (e.g. session restored after
  // refresh) — return to the protected destination that sent the user here.
  // Direct visits to /admin or /admin/login have no return destination and
  // consistently land on the dashboard.
  useEffect(() => {
    if (!loading && adminUser && isAdmin) {
      navigate(returnPath, { replace: true })
    }
  }, [loading, adminUser, isAdmin, navigate, returnPath])

  // Session exists but we couldn't confirm admin status because of a
  // network/Firestore error — don't silently show an empty login form as
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
      console.error('Admin login: Firebase sign-in failed.', err)
      setError(friendlyFirebaseError(err))
      setSubmitting(false)
      return
    }

    if (!credentialUser) {
      setSubmitting(false)
      return
    }

    try {
      const profile = await getAdminProfile(credentialUser.uid)
      if (!profile) {
        await firebaseSignOut(firebaseAuth)
        setError('This account does not have admin access.')
        setSubmitting(false)
        return
      }

      navigate(returnPath, { replace: true })
    } catch (err) {
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
