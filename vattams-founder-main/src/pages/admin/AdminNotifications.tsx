import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminNav from '@/components/AdminNav'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { NOTIFICATION_TYPE_META, type AppNotification } from '@/types/notifications'

const PAGE_SIZE = 30
const MAX_LOADED = 150

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
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

// Admin notifications are all role broadcasts (see recipient-model note
// in src/lib/notifications.ts) — every admin sees the same shared feed,
// and "mark as read" affects that shared document. Acceptable for a
// small admin team on the fixed notifications schema; see delivery report.
export default function AdminNotifications() {
  const { adminUser, isAdmin, loading } = useAdminAuth()
  const navigate = useNavigate()
  const [rowLimit, setRowLimit] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { notifications, unreadCount, state, markAsRead, markAllAsRead } = useNotifications(
    adminUser?.uid ?? null,
    isAdmin ? 'admin' : null,
    rowLimit
  )

  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications),
    [notifications, filter]
  )

  function handleOpen(n: AppNotification) {
    if (!n.is_read) markAsRead(n.id)
    if (n.action_url) navigate(n.action_url)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <AdminNav active="notifications" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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

      {loading && (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      )}

      {!loading && !isAdmin && <p className="mt-8 text-sm text-danger">This account does not have admin access.</p>}

      {!loading && isAdmin && state === 'loading' && (
        <div className="mt-10 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      )}

      {!loading && isAdmin && state === 'error' && (
        <p className="mt-8 text-sm text-danger">Unable to load notifications right now. Please check your connection.</p>
      )}

      {!loading && isAdmin && state === 'loaded' && visible.length === 0 && (
        <p className="mt-8 text-sm text-slate-muted">
          {filter === 'unread' ? "You're all caught up." : 'No notifications yet.'}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {visible.map((n) => (
          <Row key={n.id} notification={n} onOpen={handleOpen} />
        ))}
      </div>

      {isAdmin && state === 'loaded' && notifications.length >= rowLimit && rowLimit < MAX_LOADED && (
        <div className="mt-6 text-center">
          <button onClick={() => setRowLimit((n) => Math.min(n + PAGE_SIZE, MAX_LOADED))} className="btn-secondary text-sm">
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
