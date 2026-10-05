import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// initializeApp() does NOT validate its config — pass it an object full of
// `undefined`s (e.g. because .env / .env.local has no VITE_FIREBASE_* vars,
// or Vite wasn't restarted after adding them) and it will happily return a
// broken app. Nothing fails until much later, deep inside Firebase Auth,
// as `Firebase: Error (auth/configuration-not-found)` — a message that
// gives no hint that the real problem is a missing environment variable.
// Fail fast here instead, with the exact variable names that are missing.
const REQUIRED_FIREBASE_ENV_VARS = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
] as const

const missingFirebaseEnvVars = REQUIRED_FIREBASE_ENV_VARS.filter(([, value]) => !value).map(
  ([name]) => name
)

if (missingFirebaseEnvVars.length > 0) {
  throw new Error(
    `Firebase configuration is missing required environment variable(s): ${missingFirebaseEnvVars.join(', ')}.\n\n` +
      'Add them to .env.local (see .env.example) with the values from ' +
      'Firebase Console \u2192 Project settings \u2192 General \u2192 Your apps \u2192 SDK setup and configuration, ' +
      'then restart the Vite dev server \u2014 Vite only reads environment variables at startup.'
  )
}

const app = initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)
// Keep recently-read Firestore data available during slow/intermittent connectivity.\n// If IndexedDB persistence is unavailable, fall back to the normal Firestore client.\nlet firestore\ntry {\n  firestore = initializeFirestore(app, {\n    localCache: persistentLocalCache({\n      tabManager: persistentMultipleTabManager(),\n    }),\n  })\n} catch {\n  firestore = getFirestore(app)\n}\n\nexport { firestore }

export default app