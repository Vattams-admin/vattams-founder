import { useRegisterSW } from 'virtual:pwa-register/react'

// Shows a small toast when a new version of the app has been downloaded
// in the background. Nothing reloads until the user taps "Update" — no
// aggressive forced reloads, no interruption of whatever they're doing.
//
// needRefresh: a new service worker is installed and waiting.
// offlineReady: first-time install finished precaching the app shell
// (harmless to show briefly; auto-dismissed).
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('VATTAMS ACADEMIA — service worker registration failed:', error)
    },
  })

  if (!needRefresh && !offlineReady) return null

  function dismiss() {
    setNeedRefresh(false)
    setOfflineReady(false)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-card border border-gold/25 bg-ink/95 p-4 shadow-lg backdrop-blur"
    >
      {needRefresh ? (
        <>
          <p className="text-sm font-medium text-parchment">A new version of VATTAMS ACADEMIA is ready.</p>
          <p className="mt-1 text-xs text-slate-muted">Update now, or keep using the current version — your session won&apos;t be interrupted either way.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="btn-primary px-3 py-1.5 text-xs"
              aria-label="Update VATTAMS ACADEMIA to the latest version"
            >
              Update
            </button>
            <button
              onClick={dismiss}
              className="btn-secondary px-3 py-1.5 text-xs"
              aria-label="Dismiss update notice"
            >
              Later
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-parchment">Ready to work offline.</p>
          <button
            onClick={dismiss}
            className="text-xs text-slate-muted hover:text-parchment"
            aria-label="Dismiss offline-ready notice"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
