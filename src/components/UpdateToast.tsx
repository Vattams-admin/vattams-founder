import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,

    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      // Check periodically so every user's app can discover
      // a newly deployed version without manually clearing cache.
      const checkForUpdate = () => {
        registration.update().catch((error) => {
          console.warn(
            'VATTAMS ACADEMIA — service worker update check failed:',
            error,
          )
        })
      }

      checkForUpdate()

      const interval = window.setInterval(
        checkForUpdate,
        UPDATE_CHECK_INTERVAL,
      )

      window.addEventListener('online', checkForUpdate)

      ;(registration as ServiceWorkerRegistration & {
        __vattamsCleanup?: () => void
      }).__vattamsCleanup = () => {
        window.clearInterval(interval)
        window.removeEventListener('online', checkForUpdate)
      }
    },

    onRegisterError(error) {
      console.error(
        'VATTAMS ACADEMIA — service worker registration failed:',
        error,
      )
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh && !offlineReady) {
    return null
  }

  function dismissOfflineReady() {
    setOfflineReady(false)
  }


  /*
   * Offline-ready notification is informational only.
   * It does not interfere with application updates.
   */
  if (offlineReady && !needRefresh) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-card border border-gold/25 bg-ink/95 p-4 shadow-lg backdrop-blur"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-parchment">
            VATTAMS ACADEMIA is ready for offline use.
          </p>

          <button
            onClick={dismissOfflineReady}
            className="text-xs text-slate-muted hover:text-parchment"
            aria-label="Dismiss offline-ready notice"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return null
}
