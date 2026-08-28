// Maps a caught Firestore error to a headline + actionable detail for
// admin-facing pages. The point of this file: AdminLiveSessions.tsx
// (and, until this pass, AdminCourseMaterials.tsx) previously showed
// "Unable to connect / Please check your internet connection" for
// EVERY caught error, including firebase/firestore permission-denied —
// which has nothing to do with the network and hides the real problem
// (a Firestore rules/authorization gap) behind a message that sends
// whoever's debugging it looking at their Wi-Fi instead of the rules
// file. See docs/LIVE-SESSIONS-ADMIN-FIX-REPORT.md for the incident
// this was written for.
//
// The raw error is always still logged to the console (dev and prod —
// admins debugging a production issue need this) — never swallowed.

export interface ClassifiedFirestoreError {
  /** Raw Firestore/Firebase error code, e.g. "permission-denied". Null if not a recognized Firebase error shape. */
  code: string | null
  /** Short, user-facing headline. */
  headline: string
  /** One or two sentences of actionable detail — what actually happened and, where useful, what to check. */
  detail: string
  /** True for errors that are plausibly resolved by pressing Retry (network blips, exhausted quota, transient unavailability). False for errors Retry cannot fix (permission-denied, not-found, invalid-argument) — the UI can still offer Retry, but shouldn't imply it's likely to help. */
  retryable: boolean
}

export function classifyFirestoreError(error: unknown, context: string): ClassifiedFirestoreError {
  console.error(`[${context}]`, error)

  const code = (error as { code?: string } | null)?.code ?? null

  switch (code) {
    case 'permission-denied':
      return {
        code,
        headline: 'Access denied',
        detail:
          'Your admin account was denied read access by the current Firestore security rules — this is a permissions/configuration issue, not a network problem. Confirm firestore.rules has been deployed to this Firebase project (Firebase Console → Firestore Database → Rules) and that your admin account has an active document at admins/{your-uid} with is_active: true.',
        retryable: false
      }
    case 'unauthenticated':
      return {
        code,
        headline: 'Not signed in',
        detail: 'Your session may have expired. Please sign out and sign back in.',
        retryable: false
      }
    case 'failed-precondition':
      return {
        code,
        headline: 'Query needs configuration',
        detail:
          'This query requires a Firestore index that has not been created yet. Open the browser console — Firestore includes a direct link to create the missing index in the error it just logged there.',
        retryable: false
      }
    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      return {
        code,
        headline: 'Unable to connect',
        detail: 'Please check your internet connection and try again.',
        retryable: true
      }
    case 'resource-exhausted':
      return {
        code,
        headline: 'Temporarily unavailable',
        detail: 'This Firebase project has hit a usage quota. Try again shortly, or check the Firebase Console for quota alerts.',
        retryable: true
      }
    case 'not-found':
      return {
        code,
        headline: 'Not found',
        detail: 'The requested data does not exist — it may have been deleted.',
        retryable: false
      }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('network') || message.includes('offline') || message.includes('failed to fetch')) {
    return {
      code,
      headline: 'Unable to connect',
      detail: 'Please check your internet connection and try again.',
      retryable: true
    }
  }

  return {
    code,
    headline: 'Something went wrong',
    detail:
      error instanceof Error && error.message
        ? error.message
        : 'An unexpected error occurred. Please try again, and check the browser console for details.',
    retryable: true
  }
}
