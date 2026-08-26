import type { AuthError } from 'firebase/auth'

// Network-resilience hardening: several pages (Auth.tsx, StudentRegister.tsx,
// TutorRegister.tsx) previously did `setError(err.message)` on any failed
// Firebase Auth call, which shows the user raw strings like
// "Firebase: Error (auth/network-request-failed)." or
// "FirebaseError: Failed to get document because the client is offline."
// This maps known Firebase Auth error codes (and a few Firestore/network
// failure shapes that aren't AuthErrors) to short, friendly copy. Unknown
// errors still fall back to a generic message rather than leaking
// implementation details. The original error is always still logged to the
// console for debugging — never shown to the user.
export function friendlyAuthError(err: unknown, action: 'sign in' | 'create your account' = 'sign in'): string {
  console.error(`Auth error while trying to ${action}:`, err)

  const code = (err as Partial<AuthError>)?.code

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.'
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 8 characters).'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Unable to connect right now. Please check your internet connection and try again.'
    case 'unavailable':
    case 'deadline-exceeded':
      // Firestore's own error codes (e.g. from a setDoc call), not auth/*.
      return 'Unable to connect right now. Please check your internet connection and try again.'
  }

  // Not a recognized Firebase error code — could still be a plain network
  // failure (e.g. a raw TypeError: Failed to fetch) surfacing as a generic
  // Error with no `code`. Check the message text as a fallback rather than
  // showing it directly.
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  if (message.includes('network') || message.includes('offline') || message.includes('failed to fetch')) {
    return 'Unable to connect right now. Please check your internet connection and try again.'
  }

  return `Unable to ${action === 'sign in' ? 'sign in' : action} right now. Please try again.`
}
