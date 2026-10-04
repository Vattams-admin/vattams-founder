import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUserRole } from '@/hooks/useUserRole'
import { useNotifications } from '@/hooks/useNotifications'
import { NOTIFICATION_TYPE_META, type AppNotification } from '@/types/notifications'

const PAGE_SIZE = 30
const MAX_LOADED = 150

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function groupByDay(notifications: AppNotification[]): { label: string; rows: AppNotification[] }[] {
  const groups = new Map<string, AppNotification[]>()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const n of notifications) {
    const d = new Date(n.created_at)
    const key = Number.isNaN(d.getTime())
      ? 'Earlier'
      : d.toDateString() === today
        ? 'Today'
        : d.toDateString() === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  return Array.from(groups.entries()).map(([label, rows]) => ({ label, rows }))
}

function isSafeInternalPath(actionUrl: string): boolean {
  if (!actionUrl.startsWith('/') || actionUrl.startsWith('//')) return false
  if (/^[\\u0000-\\u001f]/.test(actionUrl)) return false

  try {
    const resolved = new URL(actionUrl, window.location.origin)
    return resolved.origin === window.location.origin
  } catch {
    return false
  }
}

function Row({ notification, onOpen }: { notification: AppNotification; onOpen: (n: AppNotification) => void }) {
  const meta = NOTIFICATION_TYPE_META[notification.type] ?? { label: 'Update' }
  return (
    <button
      onClick={() => onOpen(notification)}
      className={`card flex w-full flex-col gap-1 p-4 text-left transition-colors hover:border-gold/40 ${
        notification.is_read ? '' : 'border-gold/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-gold-muted">{meta.label}</span>
          {!notification.is_read && <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" aria-hidden="true" />}
        </span>
        <span className="shrink-0 text-xs text-slate-muted">{timeLabel(notification.created_at)}</span>
      </div>
      <p className={`text-sm font-medium ${notification.is_read ? 'text-slate-muted' : 'text-parchment'}`}>
        {notification.title}
      </p>
      <p className="text-sm text-slate-muted">{notification.message}</p>
    </button>
  )
}

export default function Notifications() {
  const { user, loading: authLoading } = useAuth()
  const { role, loading: roleLoading } = useUserRole()
  const navigate = useNavigate()
  const [rowLimit, setRowLimit] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { notifications, unreadCount, state, markAsRead, markAllAsRead } = useNotifications(
    user?.id ?? null,
    role,
    rowLimit
  )

  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter]
  )
  const groups = useMemo(() => groupByDay(visible), [visible])

  if (authLoading || roleLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-slate-muted">Loading…</div>
  }
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/notifications' }} replace />

  function handleOpen(n: AppNotification) {
    if (!n.is_read) markAsRead(n.id)
    if (n.action_url && isSafeInternalPath(n.action_url)) navigate(n.action_url)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-secondary text-xs">
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-card px-3 py-1.5 text-sm font-medium ${
            filter === 'all' ? 'bg-gold/15 text-gold-bright' : 'text-slate-muted hover:text-parchment'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-card px-3 py-1.5 text-sm font-medium ${
            filter === 'unread' ? 'bg-gold/15 text-gold-bright' : 'text-slate-muted hover:text-parchment'
          }`}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      {!role && (
        <p className="mt-8 text-sm text-slate-muted">
          We couldn&apos;t find a student or tutor profile for your account, so there&apos;s nothing to show here yet.
        </p>
      )}

      {role && state === 'loading' && (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      )}

      {role && state === 'error' && (
        <p className="mt-8 text-sm text-danger">Unable to load notifications right now. Please check your connection.</p>
      )}

      {role && state === 'loaded' && visible.length === 0 && (
        <p className="mt-8 text-sm text-slate-muted">
          {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-muted">{group.label}</h2>
            <div className="space-y-2">
              {group.rows.map((n) => (
                <Row key={n.id} notification={n} onOpen={handleOpen} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {role && state === 'loaded' && notifications.length >= rowLimit && rowLimit < MAX_LOADED && (
        <div className="mt-6 text-center">
          <button onClick={() => setRowLimit((n) => Math.min(n + PAGE_SIZE, MAX_LOADED))} className="btn-secondary text-sm">
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
