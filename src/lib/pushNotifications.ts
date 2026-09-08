import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export async function registerAdminPushNotifications(): Promise<string> {
  console.log('PUSH: registration started')

  if (!firebaseAuth.currentUser) {
    throw new Error('Admin must be signed in before enabling notifications.')
  }

  console.log('PUSH: admin signed in')

  if (!VAPID_KEY) {
    throw new Error('VITE_FIREBASE_VAPID_KEY is not configured.')
  }

  console.log('PUSH: VAPID key found')

  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications.')
  }

  console.log('PUSH: Notification API available')
  console.log('PUSH: checking Firebase Messaging support...')

  const supported = await isSupported()
  console.log('PUSH: Firebase Messaging supported:', supported)

  if (!supported) {
    throw new Error(
      'Firebase Cloud Messaging is not supported on this device/browser.',
    )
  }

  console.log('PUSH: requesting notification permission...')

  const permission = await Notification.requestPermission()
  console.log('PUSH: notification permission:', permission)

  if (permission !== 'granted') {
    throw new Error(`Notification permission was ${permission}.`)
  }

  console.log('PUSH: waiting for service worker...')

  const registration = await navigator.serviceWorker.ready
  console.log('PUSH: service worker ready:', registration)

  console.log('PUSH: creating Firebase Messaging instance...')

  const messaging = getMessaging()

  console.log('PUSH: Firebase Messaging instance created')
  console.log('PUSH: requesting FCM registration token...')

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  console.log('PUSH: FCM token received:', Boolean(token))

  if (!token) {
    throw new Error('Firebase did not return an FCM registration token.')
  }

  const currentUser = firebaseAuth.currentUser

  if (!currentUser) {
    throw new Error('Admin session ended before the FCM token could be saved.')
  }

  console.log('PUSH: saving FCM token to Firestore...')

  await setDoc(doc(firestore, 'push_tokens', token), {
    uid: currentUser.uid,
    token,
    updated_at: serverTimestamp(),
  }, { merge: true })

  console.log('PUSH: FCM token saved successfully')

  return token
}

export function listenForForegroundMessages(
  callback: (payload: MessagePayload) => void,
): () => void {
  console.log('PUSH: starting foreground message listener')

  const messaging = getMessaging()

  return onMessage(messaging, callback)
}
