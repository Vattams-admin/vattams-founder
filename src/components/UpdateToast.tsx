import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000

function isLiveClassroom(pathname: string) {
  return pathname.startsWith('/live-classroom/')
}

export default function UpdateToast() {
  const location = useLocation()

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

  /*
   * Automatic update policy:
   *
   * - Normal pages:
   *     New version -> activate automatically.
   *
   * - Live classroom:
   *     Do NOT activate while the user is teaching/attending.
   *     This prevents a deployment from interrupting WebRTC.
   *
   * - Once the user leaves the classroom:
   *     The waiting update is applied automatically.
   */
  useEffect(() => {
    if (!needRefresh) return

    if (isLiveClassroom(location.pathname)) {
      return
    }

    updateServiceWorker(true)
  }, [needRefresh, location.pathname, updateServiceWorker])

  /*
   * If a new version was waiting while the user was inside the
   * classroom, apply it automatically as soon as they leave.
   */
  useEffect(() => {
    if (!needRefresh) return

    if (isLiveClassroom(location.pathname)) return

    updateServiceWorker(true)
  }, [location.pathname, needRefresh, updateServiceWorker])

  if (!needRefresh && !offlineReady) {
    return null
  }

  function dismissOfflineReady() {
    setOfflineReady(false)
  }

  /*
   * The update is intentionally invisible to users during normal
   * operation. It is handled automatically.
   *
   * During a live classroom we show a small informational notice
   * rather than activating the update.
   */
  if (needRefresh && isLiveClassroom(location.pathname)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-card border border-gold/25 bg-ink/95 p-4 shadow-lg backdrop-blur"
      >
        <p className="text-sm font-medium text-parchment">
          A new VATTAMS ACADEMIA version is ready.
        </p>

        <p className="mt-1 text-xs text-slate-muted">
          It will update automatically after you leave the live classroom.
        </p>
      </div>
    )
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
