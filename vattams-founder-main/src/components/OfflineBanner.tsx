import { useEffect, useState } from 'react'

const CONNECTIVITY_URL = 'https://vattams-academia.firebaseapp.com/'

async function checkConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      await fetch(CONNECTIVITY_URL, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
      })
      return true
    } catch {
      return false
    }
  }

  return true
}

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    let cancelled = false

    const verifyConnection = async () => {
      const online = await checkConnectivity()
      if (!cancelled) {
        setIsOnline(online)
      }
    }

    const goOnline = () => {
      setIsOnline(true)
    }

    const goOffline = () => {
      verifyConnection()
    }

    verifyConnection()

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      cancelled = true
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full bg-danger/90 px-4 py-2 text-center text-sm font-medium text-white"
    >
      You&apos;re offline. Payments, enrolment, sign-in, and other actions that need a connection won&apos;t go through until you&apos;re back online.
    </div>
  )
}
