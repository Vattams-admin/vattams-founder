// Types and constants for the VATTAMS ACADEMIA notification system.
//
// Firestore collection: notifications/{notificationId}
// Field names and shape mirror the rest of the app's Firestore
// conventions (see src/types/database.ts, src/types/academy.ts):
// plain client-generated ISO-8601 strings for timestamps, denormalized
// display fields so list views never need a join, and a loose-enough
// `related_type` string so this stays extensible without a schema
// migration every time a new notification-producing feature ships.

export type NotificationRecipientRole = 'student' | 'tutor' | 'admin'

export const STUDENT_NOTIFICATION_TYPES = [
  'registration_success',
  'enrollment_success',
  'payment_success',
  'course_access_granted',
  'new_course_material',
  'certificate_issued',
  'class_reminder',
  'class_cancelled',
  'class_rescheduled',
  // Phase 19 (Live Sessions) additions — appended per the extension
  // pattern documented below rather than replacing anything.
  'class_live_now',
  'class_recording_ready',
  'admin_announcement'
] as const

export const TUTOR_NOTIFICATION_TYPES = [
  'new_student_enrollment',
  'course_assignment',
  'class_scheduled',
  'class_reminder',
  'enrollment_update',
  'admin_announcement',
  'tutor_payment_status',
  'tutor_document_status',
  'tutor_onboarding_complete'
] as const

export const ADMIN_NOTIFICATION_TYPES = [
  'new_student_registration',
  'new_enrollment',
  'payment_received',
  'tutor_activity',
  'system_alert'
] as const

export const ALL_NOTIFICATION_TYPES = [
  ...STUDENT_NOTIFICATION_TYPES,
  ...TUTOR_NOTIFICATION_TYPES,
  ...ADMIN_NOTIFICATION_TYPES
] as const

// `notification types are extensible` per spec — new values can be
// appended to the arrays above without touching Firestore or the rules
// below (which allow any non-empty string for `type` and instead
// constrain WHO can write WHICH recipient_role, not the exact type
// string). NotificationType stays a plain string rather than a union
// for the same reason: a stricter union would force a code change
// every time a new type is added, which is exactly what "keep
// extensible" is asking us to avoid. The arrays above remain the
// source of truth for the UI (icons, labels, filters).
export type NotificationType = string

export interface AppNotification {
  id: string
  recipient_uid: string | null
  recipient_role: NotificationRecipientRole
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  related_type: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

// Icon + label metadata for the bell/panel/page UI. Falls back to a
// generic bell + title-cased type string for any type not listed here,
// so a future type never breaks rendering.
export const NOTIFICATION_TYPE_META: Record<string, { label: string; icon: 'check' | 'card' | 'book' | 'certificate' | 'bell' | 'clock' | 'x' | 'calendar' | 'megaphone' | 'user' | 'alert' }> = {
  registration_success: { label: 'Registration', icon: 'check' },
  enrollment_success: { label: 'Enrollment', icon: 'book' },
  payment_success: { label: 'Payment', icon: 'card' },
  course_access_granted: { label: 'Course access', icon: 'book' },
  new_course_material: { label: 'New material', icon: 'book' },
  certificate_issued: { label: 'Certificate', icon: 'certificate' },
  class_reminder: { label: 'Class reminder', icon: 'clock' },
  class_cancelled: { label: 'Class cancelled', icon: 'x' },
  class_rescheduled: { label: 'Class rescheduled', icon: 'calendar' },
  class_live_now: { label: 'Live now', icon: 'bell' },
  class_recording_ready: { label: 'Recording available', icon: 'book' },
  admin_announcement: { label: 'Announcement', icon: 'megaphone' },
  new_student_enrollment: { label: 'New enrollment', icon: 'user' },
  course_assignment: { label: 'Course assignment', icon: 'book' },
  class_scheduled: { label: 'Class scheduled', icon: 'calendar' },
  enrollment_update: { label: 'Enrollment update', icon: 'book' },
  new_student_registration: { label: 'New registration', icon: 'user' },
  new_enrollment: { label: 'New enrollment', icon: 'book' },
  payment_received: { label: 'Payment received', icon: 'card' },
  tutor_payment_status: { label: 'Registration payment', icon: 'card' },
  tutor_document_status: { label: 'Onboarding document', icon: 'book' },
  tutor_onboarding_complete: { label: 'Onboarding complete', icon: 'check' },
  tutor_activity: { label: 'Tutor activity', icon: 'user' },
  system_alert: { label: 'System alert', icon: 'alert' }
}
