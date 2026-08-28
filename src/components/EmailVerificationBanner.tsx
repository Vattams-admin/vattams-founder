import { useEffect, useState } from 'react'
import { sendEmailVerification, type User } from 'firebase/auth'

const RESEND_COOLDOWN_SECONDS = 60

// Deliberately non-blocking: this never prevents login, never hides the
// dashboard, and never locks a student out of a course they've paid
// for. It's informational only, with a rate-limited resend so a student
// who genuinely didn't get the first email (spam filters, a typo they
// can't easily fix here) has a way forward without being able to spam
// Firebase's email quota.
export default function EmailVerificationBanner({ user }: { user: User }) {
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (user.emailVerified || dismissed) return null

  async function handleResend() {
    if (sending || cooldown > 0) return
    setSending(true)
    setFeedback(null)
    try {
      await sendEmailVerification(user)
      setFeedback('Verification email sent — check your inbox (and spam folder).')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/too-many-requests') {
        setFeedback('Too many attempts. Please wait a moment and try again.')
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else {
        console.error('Failed to resend verification email:', err)
        setFeedback('Unable to send right now. Please check your connection and try again.')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-card border border-gold/30 bg-gold/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-parchment">Please verify your email address</p>
        <p className="mt-0.5 text-slate-muted">
          {feedback ?? `We sent a verification link to ${user.email ?? 'your email'}.`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={handleResend}
          disabled={sending || cooldown > 0}
          className="btn-secondary text-xs disabled:opacity-60"
        >
          {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-xs text-slate-muted hover:text-parchment"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
