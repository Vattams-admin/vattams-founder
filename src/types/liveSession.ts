// Types for the VATTAMS ACADEMIA Live Session system (Phase 19).
//
// Firestore collections:
//   live_sessions/{sessionId}          — one doc per scheduled class
//   session_attendance/{sessionId_studentId} — one doc per (session, student)
//
// IMPORTANT — what this project actually has vs. what Phase 19's spec
// assumes:
//
// The spec describes a COURSE → CLASSROOM → BATCH → TUTOR hierarchy.
// Nothing in this codebase has a `classrooms` or `batches` collection —
// the only real relationships that exist today are:
//   courses/{courseId}                 (src/types/database.ts)
//   enrolments/{studentId}_{courseId}  (student_id, course_id, status)
//   tutors/{uid}                       (no course/tutor assignment table)
//
// Rather than invent Classroom/Batch collections that nothing else in
// the app reads or writes (which would be fake scaffolding, not a real
// feature), a live session is scoped directly to a `course_id` — the
// one grouping concept that already exists and already gates access
// via the `enrolments` collection (see hasActiveEnrolment() in
// firestore.rules). `batch_label` is kept as a free-text field so a
// tutor can still distinguish "Batch A" / "Weekday Evening" etc. for
// display, but it is NOT a foreign key into any Batch collection,
// because no such collection exists.
//
// Timestamps are plain client-generated ISO-8601 strings, matching
// every other collection in this project (see src/types/database.ts,
// src/types/notifications.ts) — not Firestore Timestamp/serverTimestamp.

export type LiveSessionStatus = 'draft' | 'published' | 'cancelled' | 'archived'

// google_meet / zoom / microsoft_teams / external cover the meeting
// link itself opening in another tab — this project has no embedded
// video SDK of any kind, and none is faked here (see spec: "Do NOT
// create fake video functionality").
export type MeetingProvider = 'google_meet' | 'zoom' | 'microsoft_teams' | 'external'

export interface LiveSessionMaterial {
  name: string
  url: string
}

export interface RescheduleHistoryEntry {
  previous_start_time: string
  previous_end_time: string
  changed_at: string
  changed_by: string
}

export interface LiveSession {
  id: string
  course_id: string
  // Denormalized at creation time (see src/types/database.ts pattern) so
  // list views never need a join.
  course_name: string | null
  course_slug: string | null
  // Free-text only — see the collection-level comment above.
  batch_label: string | null
  tutor_id: string
  tutor_name: string | null
  title: string
  topic: string | null
  description: string | null
  start_time: string
  end_time: string
  meeting_provider: MeetingProvider
  meeting_url: string | null
  recording_url: string | null
  session_notes: string | null
  materials: LiveSessionMaterial[]
  status: LiveSessionStatus
  cancelled_reason: string | null
  cancelled_at: string | null
  reschedule_history: RescheduleHistoryEntry[]
  created_by: string
  created_at: string
  updated_at: string
}

// The spec's "Draft / Scheduled / Published / Starting Soon / Live /
// Ended / Cancelled / Rescheduled / Archived" state list mixes a
// STORED status (draft/published/cancelled/archived — a human
// decision) with a TIME-DERIVED phase (starting soon/live/ended — a
// fact about the clock). Storing "live" or "ended" as a field that a
// human has to flip at the right second is exactly the kind of
// unreliable manual step the spec elsewhere warns against ("Do not
// rely solely on client-side time for authorization" is about
// *authorization*, not display) — so those phases are always computed
// fresh from start_time/end_time + status, never stored. "Rescheduled"
// is not a phase here; it is recorded as an entry in
// reschedule_history and the session simply continues as a normal
// published session at its new time (with a "Rescheduled" ribbon shown
// when history is non-empty and the session hasn't started yet).
export type LiveSessionPhase =
  | 'draft'
  | 'upcoming'
  | 'starting_soon'
  | 'live'
  | 'ended'
  | 'cancelled'
  | 'archived'

// How long before start_time the UI switches from "Upcoming" to
// "Starting Soon" with a countdown.
export const STARTING_SOON_WINDOW_MS = 15 * 60 * 1000

export function computeLiveSessionPhase(
  session: Pick<LiveSession, 'status' | 'start_time' | 'end_time'>,
  now: Date = new Date()
): LiveSessionPhase {
  if (session.status === 'cancelled') return 'cancelled'
  if (session.status === 'archived') return 'archived'
  if (session.status === 'draft') return 'draft'

  const start = new Date(session.start_time).getTime()
  const end = new Date(session.end_time).getTime()
  const nowMs = now.getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming'

  if (nowMs > end) return 'ended'
  if (nowMs >= start) return 'live'
  if (nowMs >= start - STARTING_SOON_WINDOW_MS) return 'starting_soon'
  return 'upcoming'
}

export type AttendanceStatus = 'present' | 'late' | 'partial' | 'absent' | 'excused'

export interface SessionAttendanceRecord {
  // Deterministic id: `${session_id}_${student_id}` — mirrors the
  // enrolments/{student_id}_{course_id} convention already used
  // elsewhere in this app (see src/pages/admin/AdminPayments.tsx),
  // both so a student can never create two attendance rows for the
  // same session and so Firestore security rules can address a
  // specific row by path (rules cannot run `where` queries).
  id: string
  session_id: string
  course_id: string
  student_id: string
  student_name: string | null
  status: AttendanceStatus | null
  // 'self_reported' = the student's own client recorded that they
  // opened the Join button — NOT proof of full attendance (this
  // project has no meeting-provider webhook/API integration to verify
  // presence; see spec's own "clearly mark attendance as
  // approximate/manual" requirement). 'tutor_marked' / 'admin_marked'
  // is a human override after the fact.
  source: 'self_reported' | 'tutor_marked' | 'admin_marked'
  joined_at: string | null
  marked_by: string | null
  marked_at: string | null
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  partial: 'Partial',
  absent: 'Absent',
  excused: 'Excused'
}
