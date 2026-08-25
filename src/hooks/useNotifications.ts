import { useEffect, useState } from 'react'
import type { AppNotification, NotificationRecipientRole } from '@/types/notifications'
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToUnreadCount,
  subscribeToUserNotifications
} from '@/lib/notifications'

export type NotificationsLoadState = 'loading' | 'loaded' | 'error'

/**
 * Shared realtime notification state for a signed-in user — used by both
 * the header bell/dropdown and the full notification page so they never
 * duplicate listener logic or drift out of sync with each other.
 *
 * Cleans up its Firestore listeners on unmount / whenever uid or role
 * change (e.g. the resolved role flips while useUserRole is still
 * loading, or the user signs out).
 */
export function useNotifications(uid: string | null, role: NotificationRecipientRole | null, rowLimit = 30) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [state, setState] = useState<NotificationsLoadState>('loading')

  useEffect(() => {
    if (!uid || !role) {
      setNotifications([])
      setUnreadCount(0)
      setState('loaded')
      return
    }

    setState('loading')

    const unsubscribeFeed = subscribeToUserNotifications(
      uid,
      role,
      rowLimit,
      (rows) => {
        setNotifications(rows)
        setState('loaded')
      },
      () => setState('error')
    )

    const unsubscribeCount = subscribeToUnreadCount(uid, role, setUnreadCount)

    return () => {
      unsubscribeFeed()
      unsubscribeCount()
    }
  }, [uid, role, rowLimit])

  async function markAsRead(notificationId: string) {
    // Optimistic local update — the realtime listener will reconcile
    // shortly after, but this makes the tap feel instant.
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)))
    await markNotificationAsRead(notificationId)
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.is_read)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await markAllNotificationsAsRead(unread)
  }

  return { notifications, unreadCount, state, markAsRead, markAllAsRead }
}
