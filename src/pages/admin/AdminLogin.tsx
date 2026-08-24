import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type AuthError,
} from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { getAdminProfile } from '@/lib/adminData'
import { useAdminAuth } from '@/hooks/useAdminAuth'

// Admin identity is Firebase Auth + a Firestore `admins/{uid}` doc (see
// src/lib/adminData.ts). But every admin-only Supabase RLS policy is
// still gated on `is_admin()`, which checks `auth.uid()` — Supabase's
// own JWT session, unrelated to Firebase. So a successful admin login
// signs the same person into BOTH systems with the same email/password:
// Firebase is the source of truth for "is this person an admin" (via
// Firestore), and the parallel Supabase session is what lets the admin
// pages' existing Supabase queries (payments, courses) pass RLS. This
// requires the admin to already exist in both systems with matching
// credentials — see the deployment note in adminData.ts.

function friendlyFirebaseError(err: unknown): string {
  const code = (err as Partial<AuthError>)?.code

  const message = (() => {
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
  })()

  // TEMPORARY DIAGNOSTIC — dev-only. Appends the Firebase error code (never
  // secrets/tokens/passwords) so we can identify the exact failure mode.
  // Also logs the full error object to the console, dev-only. Remove once
  // the root cause is confirmed.
  if (import.meta.env.DEV) {
    if (code) {
      console.error('[AdminLogin diagnostic] Firebase auth error:', err)
      return `${message} Firebase error: ${code}`
    }
    console.error('[AdminLogin diagnostic] Non-Firebase error during sign-in:', err)
  }

  return message
}

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { adminUser, isAdmin, loading } = useAdminAuth()

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
      navigate('/admin', { replace: true })
    }
  }, [loading, adminUser, isAdmin, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setSubmitting(true)

    let firebaseSignedIn = false

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      )
      firebaseSignedIn = true

      // Membership in Firestore `admins` is what grants admin access —
      // not merely having a Firebase account.
      const profile = await getAdminProfile(credential.user.uid)
      if (!profile) {
        await firebaseSignOut(firebaseAuth)
        setError('This account does not have admin access.')
        setSubmitting(false)
        return
      }

      // Mirror the same credentials into Supabase so `auth.uid()` in
      // RLS policies resolves for this session too. If this fails, the
      // Firebase side is rolled back rather than leaving a half-signed-in
      // admin who can pass the Firestore check but fail every RLS-gated
      // action on the payments/courses pages.
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (supabaseError) {
        await firebaseSignOut(firebaseAuth)
        setError(
          'Your admin account is not fully set up for this login yet. ' +
            'Please contact the site administrator.'
        )
        setSubmitting(false)
        return
      }

      navigate('/admin')
    } catch (err) {
      if (firebaseSignedIn) {
        await firebaseSignOut(firebaseAuth).catch(() => {})
      }
      setError(friendlyFirebaseError(err))
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