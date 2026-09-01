import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { AppNotification, NotificationRecipientRole, NotificationType } from '@/types/notifications'

// Single reusable notification service for the whole app — every
// notification-creating flow (registration, payment, enrollment,
// certificates, ...) goes through createNotification() /
// createAdminBroadcast() here instead of writing to the `notifications`
// collection directly, so there is exactly one place that owns the
// document shape.
//
// Timestamp convention matches the rest of the app (students, tutors,
// payments, certificates): a plain client-generated ISO-8601 string via
// new Date().toISOString(), not serverTimestamp() — see
// src/pages/StudentRegister.tsx / src/lib/academyAdmin.ts.
//
// RECIPIENT MODEL — read this before wiring a new notification:
// This project is a pure client SPA (no Cloud Functions, no backend —
// see src/lib/firebase.ts and the absence of a functions/ directory),
// so there is no trusted server process to fan a notification out to
// "every admin" by uid. Enumerating admin uids on the client so a
// student could address them directly would also leak admin identity
// to anyone who opens dev tools. So admin- and tutor-role
// notifications that originate from a lower-privilege action (a student
// registering, submitting a payment, a tutor applying) are written as
// role broadcasts: recipient_uid: null, recipient_role: 'admin' | 'tutor'.
// Firestore security rules (see the delivery report) allow any
// authenticated user to create ONLY this narrow shape for an allow-
// listed set of types, and allow only a verified admin/tutor to read or
// mark read a broadcast addressed to their role. Because is_read is a
// single field on a shared document, marking a broadcast notification
// read marks it read for every admin/tutor who can see it — an
// accepted tradeoff of the fixed schema (see delivery report).
//
// Student- and self-targeted notifications (a specific uid) are used
// wherever the schema allows a real 1:1 recipient: a student's own
// registration_success, or anything an admin creates on a student's
// behalf after verifying an action (payment_success, enrollment_success,
// certificate_issued, ...) — admin write authority is enforced by rules
// via the existing admins/{uid} document (see src/lib/adminData.ts).

const COLLECTION = 'notifications'

export interface CreateNotificationInput {
  /** A specific user's uid, or null for a recipient_role broadcast. */
  recipient_uid: string | null
  recipient_role: NotificationRecipientRole
  type: NotificationType
  title: string
  message: string
  related_id?: string | null
  related_type?: string | null
  action_url?: string | null
}

/**
 * Creates a single notification document. Never throws to the caller —
 * notification delivery must never block or fail the real action it's
 * attached to (registration, payment, enrollment, certificate
 * issuance). Failures are logged and swallowed; the UI event that
 * triggered the notification proceeds normally either way.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await addDoc(collection(firestore, COLLECTION), {
      recipient_uid: input.recipient_uid,
      recipient_role: input.recipient_role,
      type: input.type,
      title: input.title,
      message: input.message,
      related_id: input.related_id ?? null,
      related_type: input.related_type ?? null,
      action_url: input.action_url ?? null,
      is_read: false,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    // See CreateNotificationInput doc comment — never surfaced to the
    // caller. Logged so it's still visible in dev/console.
    console.error(`[notifications] Failed to create "${input.type}" notification:`, error)
  }
}

/** Convenience wrapper for the recipient_uid: null role-broadcast shape described above. */
export function createAdminBroadcast(
  input: Omit<CreateNotificationInput, 'recipient_uid' | 'recipient_role'>
): Promise<void> {
  return createNotification({ ...input, recipient_uid: null, recipient_role: 'admin' })
}

export function createTutorBroadcast(
  input: Omit<CreateNotificationInput, 'recipient_uid' | 'recipient_role'>
): Promise<void> {
  return createNotification({ ...input, recipient_uid: null, recipient_role: 'tutor' })
}

function toAppNotification(id: string, data: Record<string, unknown>): AppNotification {
  return {
    id,
    recipient_uid: typeof data.recipient_uid === 'string' ? data.recipient_uid : null,
    recipient_role: (data.recipient_role as NotificationRecipientRole) ?? 'student',
    type: typeof data.type === 'string' ? data.type : 'system_alert',
    title: typeof data.title === 'string' ? data.title : '',
    message: typeof data.message === 'string' ? data.message : '',
    related_id: typeof data.related_id === 'string' ? data.related_id : null,
    related_type: typeof data.related_type === 'string' ? data.related_type : null,
    action_url: typeof data.action_url === 'string' ? data.action_url : null,
    is_read: data.is_read === true,
    created_at: typeof data.created_at === 'string' ? data.created_at : ''
  }
}

/**
 * Builds the query (or pair of queries, for admin/tutor broadcasts) for
 * a user's notification feed. Kept separate from the fetch/subscribe
 * functions below so both share identical query shapes.
 */
function feedQueries(uid: string, role: NotificationRecipientRole, rowLimit: number) {
  // Both queries below combine an equality filter with orderBy on a
  // different field (created_at), which needs a composite index —
  // same situation as the existing student_id/course_id/status/created_at
  // index noted in src/pages/Payment.tsx. Firestore will show a
  // console link to create it the first time each query runs if it's
  // missing; see the delivery report for the exact fields to
  // pre-create instead of waiting for that link.
  const own = query(
    collection(firestore, COLLECTION),
    where('recipient_uid', '==', uid),
    orderBy('created_at', 'desc'),
    limit(rowLimit)
  )

  if (role === 'student') return [own]

  // Admins and tutors also see the role-wide broadcast feed (see
  // recipient model note above) alongside anything addressed to them
  // personally.
  const broadcast = query(
    collection(firestore, COLLECTION),
    where('recipient_uid', '==', null),
    where('recipient_role', '==', role),
    orderBy('created_at', 'desc'),
    limit(rowLimit)
  )
  return [own, broadcast]
}

function mergeAndSort(lists: AppNotification[][], rowLimit: number): AppNotification[] {
  const merged = lists.flat()
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return merged.slice(0, rowLimit)
}

/**
 * One-time fetch of a user's most recent notifications, latest first.
 * Used for the full notification page's initial load (realtime
 * listeners take over for live updates — see subscribeToUserNotifications).
 */
export async function getUserNotifications(
  uid: string,
  role: NotificationRecipientRole,
  rowLimit = 50
): Promise<AppNotification[]> {
  try {
    const queries = feedQueries(uid, role, rowLimit)
    const snapshots = await Promise.all(queries.map((q) => getDocs(q)))
    const lists = snapshots.map((snap) => snap.docs.map((d) => toAppNotification(d.id, d.data())))
    return mergeAndSort(lists, rowLimit)
  } catch (error) {
    console.error('[notifications] Failed to load notifications:', error)
    return []
  }
}

/**
 * Realtime subscription to a user's notification feed (bell dropdown +
 * full page). Returns a single cleanup function that unsubscribes every
 * underlying listener — callers only need to call it once, e.g. in a
 * useEffect return.
 */
export function subscribeToUserNotifications(
  uid: string,
  role: NotificationRecipientRole,
  rowLimit: number,
  onChange: (notifications: AppNotification[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const queries = feedQueries(uid, role, rowLimit)
  const latest: AppNotification[][] = queries.map(() => [])

  const unsubscribes = queries.map((q, index) =>
    onSnapshot(
      q,
      (snapshot) => {
        latest[index] = snapshot.docs.map((d) => toAppNotification(d.id, d.data()))
        onChange(mergeAndSort(latest, rowLimit))
      },
      (error) => {
        console.error('[notifications] Realtime listener error:', error)
        onError?.(error)
      }
    )
  )

  return () => unsubscribes.forEach((unsub) => unsub())
}

// Cap for the realtime unread-count listeners below. Firestore's count()
// aggregation (getCountFromServer, used in getUnreadNotificationCount)
// is a one-time read only — the client SDK has no realtime listener for
// aggregate queries, so a *live* badge has to listen to the actual
// matching documents and use snapshot.size. Capping with limit() bounds
// what that listener reads/re-reads on every change; the UI shows
// "99+" at the cap rather than claiming a false exact number (see
// NotificationBell.tsx). A precise unbounded realtime count would need
// a distributed counter maintained by a Cloud Function, which this
// project doesn't have (see the recipient-model note above) — call
// getUnreadNotificationCount() instead if an exact one-time count above
// the cap is ever needed.
const UNREAD_LISTENER_CAP = 99

/**
 * Realtime unread count. Bounded by UNREAD_LISTENER_CAP — see the
 * comment above for why an exact unbounded realtime count isn't
 * possible without a backend this project doesn't have.
 */
export function subscribeToUnreadCount(
  uid: string,
  role: NotificationRecipientRole,
  onChange: (count: number) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const ownUnread = query(
    collection(firestore, COLLECTION),
    where('recipient_uid', '==', uid),
    where('is_read', '==', false),
    limit(UNREAD_LISTENER_CAP)
  )

  const counts = { own: 0, broadcast: 0 }
  const unsubscribes: Unsubscribe[] = []

  unsubscribes.push(
    onSnapshot(
      ownUnread,
      (snapshot) => {
        counts.own = snapshot.size
        onChange(Math.min(counts.own + counts.broadcast, UNREAD_LISTENER_CAP))
      },
      (error) => {
        console.error('[notifications] Unread-count listener error:', error)
        onError?.(error)
      }
    )
  )

  if (role !== 'student') {
    const broadcastUnread = query(
      collection(firestore, COLLECTION),
      where('recipient_uid', '==', null),
      where('recipient_role', '==', role),
      where('is_read', '==', false),
      limit(UNREAD_LISTENER_CAP)
    )
    unsubscribes.push(
      onSnapshot(
        broadcastUnread,
        (snapshot) => {
          counts.broadcast = snapshot.size
          onChange(Math.min(counts.own + counts.broadcast, UNREAD_LISTENER_CAP))
        },
        (error) => {
          console.error('[notifications] Unread-count listener error:', error)
          onError?.(error)
        }
      )
    )
  }

  return () => unsubscribes.forEach((unsub) => unsub())
}

/** One-time (non-realtime) unread count — available for callers that don't need a live badge. */
export async function getUnreadNotificationCount(uid: string, role: NotificationRecipientRole): Promise<number> {
  try {
    const ownSnap = await getCountFromServer(
      query(collection(firestore, COLLECTION), where('recipient_uid', '==', uid), where('is_read', '==', false))
    )
    let total = ownSnap.data().count

    if (role !== 'student') {
      const broadcastSnap = await getCountFromServer(
        query(
          collection(firestore, COLLECTION),
          where('recipient_uid', '==', null),
          where('recipient_role', '==', role),
          where('is_read', '==', false)
        )
      )
      total += broadcastSnap.data().count
    }
    return total
  } catch (error) {
    console.error('[notifications] Failed to get unread count:', error)
    return 0
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(firestore, COLLECTION, notificationId), { is_read: true })
  } catch (error) {
    console.error('[notifications] Failed to mark notification as read:', error)
  }
}

/**
 * Marks every currently-unread notification in the given list as read
 * (batched — Firestore batches cap at 500 writes, comfortably above any
 * realistic single-page notification count). Pass the already-loaded
 * list from the bell/page rather than re-querying, so this never reads
 * more than what's already on screen.
 */
export async function markAllNotificationsAsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.is_read)
  if (unread.length === 0) return
  try {
    const batch = writeBatch(firestore)
    for (const n of unread) {
      batch.update(doc(firestore, COLLECTION, n.id), { is_read: true })
    }
    await batch.commit()
  } catch (error) {
    console.error('[notifications] Failed to mark all as read:', error)
  }
}
