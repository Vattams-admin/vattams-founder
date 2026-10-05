import { useEffect, useState } from 'react'

export default function NetworkStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="assertive"
      className="sticky top-0 z-[100] border-b border-amber-400/30 bg-amber-950/95 px-4 py-2 text-center text-xs font-semibold text-amber-100 backdrop-blur"
    >
      You are offline. Changes will resume when your connection returns.
    </div>
  )
}
