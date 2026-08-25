import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'
import { NOTIFICATION_TYPE_META, type AppNotification, type NotificationRecipientRole } from '@/types/notifications'

// No icon library is installed in this project (see package.json) — the
// existing Navbar hamburger/close icon is a raw inline <svg>, so
// notification-type icons follow the same pattern rather than adding a
// new dependency for this one feature.
function TypeIcon({ icon }: { icon: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }
  switch (icon) {
    case 'check':
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>
    case 'card':
      return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
    case 'book':
      return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
    case 'certificate':
      return <svg {...common}><circle cx="12" cy="8" r="6" /><path d="m9 13.5-1.5 7L12 18l4.5 2.5-1.5-7" /></svg>
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
    case 'x':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
    case 'megaphone':
      return <svg {...common}><path d="m3 11 18-5v12L3 13v-2Z" /><path d="M7 13v6a2 2 0 0 0 2 2h1v-7" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
    case 'alert':
      return <svg {...common}><path d="M12 2 2 20h20L12 2Z" /><path d="M12 9v5M12 17h.01" /></svg>
    default:
      return <svg {...common}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function NotificationRow({
  notification,
  onOpen
}: {
  notification: AppNotification
  onOpen: (n: AppNotification) => void
}) {
  const meta = NOTIFICATION_TYPE_META[notification.type] ?? { label: 'Update', icon: 'bell' }
  return (
    <button
      onClick={() => onOpen(notification)}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
        notification.is_read ? '' : 'bg-gold/5'
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          notification.is_read ? 'bg-white/10 text-slate-muted' : 'bg-gold/20 text-gold-bright'
        }`}
      >
        <TypeIcon icon={meta.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${notification.is_read ? 'text-slate-muted' : 'text-parchment'}`}>
            {notification.title}
          </span>
          {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright" aria-hidden="true" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-muted">{notification.message}</span>
        <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-muted/70">
          {timeAgo(notification.created_at)}
        </span>
      </span>
    </button>
  )
}

export default function NotificationBell({
  uid,
  role
}: {
  uid: string | null
  role: NotificationRecipientRole | null
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, state, markAsRead, markAllAsRead } = useNotifications(uid, role, 20)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!uid || !role) return null

  function handleOpenNotification(n: AppNotification) {
    if (!n.is_read) markAsRead(n.id)
    setOpen(false)
    if (n.action_url) navigate(n.action_url)
  }

  const notificationsHref = role === 'admin' ? '/admin/notifications' : '/notifications'

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-card text-parchment transition-colors hover:bg-white/5"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-ink">
            {unreadCount >= 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-card border border-white/10 bg-navy shadow-crest sm:w-96">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-display text-sm text-parchment">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-medium text-gold hover:text-gold-bright">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {state === 'loading' && (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
              </div>
            )}
            {state === 'error' && (
              <p className="px-4 py-8 text-center text-sm text-danger">Unable to load notifications right now.</p>
            )}
            {state === 'loaded' && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-muted">You&apos;re all caught up.</p>
            )}
            {state === 'loaded' &&
              notifications.map((n) => <NotificationRow key={n.id} notification={n} onOpen={handleOpenNotification} />)}
          </div>

          <div className="border-t border-white/10 px-4 py-2.5 text-center">
            <button
              onClick={() => {
                setOpen(false)
                navigate(notificationsHref)
              }}
              className="text-xs font-medium text-gold hover:text-gold-bright"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
