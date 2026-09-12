import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import type {
  AttendanceStatus,
  LiveSession,
  LiveSessionMaterial,
  LiveSessionStatus,
  MeetingProvider,
  RescheduleHistoryEntry,
  SessionAttendanceRecord
} from '@/types/liveSession'

// See src/types/liveSession.ts for why this is scoped to course_id and
// not a Classroom/Batch hierarchy — no such collections exist in this
// project.

const SESSIONS = 'live_sessions'
const ATTENDANCE = 'session_attendance'

function toLiveSession(id: string, data: Record<string, unknown>): LiveSession {
  return {
    id,
    course_id: typeof data.course_id === 'string' ? data.course_id : '',
    course_name: typeof data.course_name === 'string' ? data.course_name : null,
    course_slug: typeof data.course_slug === 'string' ? data.course_slug : null,
    batch_label: typeof data.batch_label === 'string' ? data.batch_label : null,
    tutor_id: typeof data.tutor_id === 'string' ? data.tutor_id : '',
    tutor_name: typeof data.tutor_name === 'string' ? data.tutor_name : null,
    title: typeof data.title === 'string' ? data.title : '',
    topic: typeof data.topic === 'string' ? data.topic : null,
    description: typeof data.description === 'string' ? data.description : null,
    start_time: typeof data.start_time === 'string' ? data.start_time : '',
    end_time: typeof data.end_time === 'string' ? data.end_time : '',
    meeting_provider: (data.meeting_provider as MeetingProvider) ?? 'external',
    meeting_url: typeof data.meeting_url === 'string' ? data.meeting_url : null,
    recording_url: typeof data.recording_url === 'string' ? data.recording_url : null,
    session_notes: typeof data.session_notes === 'string' ? data.session_notes : null,
    materials: Array.isArray(data.materials) ? (data.materials as LiveSessionMaterial[]) : [],
    status: (data.status as LiveSessionStatus) ?? 'draft',
    cancelled_reason: typeof data.cancelled_reason === 'string' ? data.cancelled_reason : null,
    cancelled_at: typeof data.cancelled_at === 'string' ? data.cancelled_at : null,
    reschedule_history: Array.isArray(data.reschedule_history)
      ? (data.reschedule_history as RescheduleHistoryEntry[])
      : [],
    created_by: typeof data.created_by === 'string' ? data.created_by : '',
    created_at: typeof data.created_at === 'string' ? data.created_at : '',
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : ''
  }
}

function toAttendance(id: string, data: Record<string, unknown>): SessionAttendanceRecord {
  return {
    id,
    session_id: typeof data.session_id === 'string' ? data.session_id : '',
    course_id: typeof data.course_id === 'string' ? data.course_id : '',
    student_id: typeof data.student_id === 'string' ? data.student_id : '',
    student_name: typeof data.student_name === 'string' ? data.student_name : null,
    status: (data.status as AttendanceStatus | null) ?? null,
    source: (data.source as SessionAttendanceRecord['source']) ?? 'self_reported',
    joined_at: typeof data.joined_at === 'string' ? data.joined_at : null,
    marked_by: typeof data.marked_by === 'string' ? data.marked_by : null,
    marked_at: typeof data.marked_at === 'string' ? data.marked_at : null
  }
}

// ---------------------------------------------------------------------
// Validation — mirrors the spec's "Validate: required fields, valid
// date/time, valid URL, tutor assignment, course/classroom
// relationship" requirement. Kept as a plain function (not a form
// library) so both the tutor and admin scheduling forms share exactly
// one set of rules.
// ---------------------------------------------------------------------

export interface LiveSessionInput {
  course_id: string
  course_name: string | null
  course_slug: string | null
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
  session_notes: string | null
  materials: LiveSessionMaterial[]
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Returns a list of human-readable problems; empty array means valid. */
export function validateLiveSessionInput(input: LiveSessionInput): string[] {
  const problems: string[] = []

  if (!input.course_id) problems.push('A course is required.')
  if (!input.tutor_id) problems.push('A tutor must be assigned.')
  if (!input.title.trim()) problems.push('A session title is required.')

  const start = new Date(input.start_time)
  const end = new Date(input.end_time)
  if (!input.start_time || Number.isNaN(start.getTime())) {
    problems.push('A valid start date/time is required.')
  }
  if (!input.end_time || Number.isNaN(end.getTime())) {
    problems.push('A valid end date/time is required.')
  }
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
    problems.push('End time must be after start time.')
  }

  if (input.meeting_url && !isValidUrl(input.meeting_url)) {
    problems.push('Meeting URL is not a valid http(s) link.')
  }

  for (const material of input.materials) {
    if (!material.url || !isValidUrl(material.url)) {
      problems.push(`Material "${material.name || 'untitled'}" has an invalid link.`)
    }
  }

  return problems
}

// ---------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------

export async function createLiveSession(
  input: LiveSessionInput,
  createdBy: string,
  status: LiveSessionStatus = 'draft'
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(collection(firestore, SESSIONS), {
    ...input,
    status,
    cancelled_reason: null,
    cancelled_at: null,
    reschedule_history: [],
    created_by: createdBy,
    created_at: now,
    updated_at: now
  })

  // Tutor gets a broadcast-free, direct confirmation only when an
  // admin scheduled the session on their behalf; if the tutor scheduled
  // it themselves there's nothing to tell them they don't already know.
  if (createdBy !== input.tutor_id) {
    void createNotification({
      recipient_uid: input.tutor_id,
      recipient_role: 'tutor',
      type: 'class_scheduled',
      title: 'New live class assigned to you',
      message: `${input.title} — ${new Date(input.start_time).toLocaleString()}`,
      related_id: ref.id,
      related_type: 'live_session',
      action_url: '/tutor/live-sessions'
    })
  }

  if (status === 'published') {
    void notifyEnrolledStudents(input.course_id, {
      type: 'class_reminder',
      title: 'New live class scheduled',
      message: `${input.title} is scheduled for ${new Date(input.start_time).toLocaleString()}.`,
      related_id: ref.id,
      action_url: `/live-session/${ref.id}`
    })
  }

  return ref.id
}

export async function publishLiveSession(session: LiveSession): Promise<void> {
  await updateDoc(doc(firestore, SESSIONS, session.id), {
    status: 'published',
    updated_at: new Date().toISOString()
  })
  void notifyEnrolledStudents(session.course_id, {
    type: 'class_reminder',
    title: 'New live class scheduled',
    message: `${session.title} is scheduled for ${new Date(session.start_time).toLocaleString()}.`,
    related_id: session.id,
    action_url: `/live-session/${session.id}`
  })
}

export async function updateLiveSessionDetails(
  session: LiveSession,
  updates: Partial<LiveSessionInput>
): Promise<void> {
  await updateDoc(doc(firestore, SESSIONS, session.id), {
    ...updates,
    updated_at: new Date().toISOString()
  })
}

export async function rescheduleLiveSession(
  session: LiveSession,
  newStartTime: string,
  newEndTime: string,
  changedBy: string
): Promise<void> {
  const historyEntry: RescheduleHistoryEntry = {
    previous_start_time: session.start_time,
    previous_end_time: session.end_time,
    changed_at: new Date().toISOString(),
    changed_by: changedBy
  }

  await updateDoc(doc(firestore, SESSIONS, session.id), {
    start_time: newStartTime,
    end_time: newEndTime,
    reschedule_history: [...session.reschedule_history, historyEntry],
    updated_at: new Date().toISOString()
  })

  void notifyEnrolledStudents(session.course_id, {
    type: 'class_rescheduled',
    title: 'Class rescheduled',
    message: `${session.title} has been moved to ${new Date(newStartTime).toLocaleString()}.`,
    related_id: session.id,
    action_url: `/live-session/${session.id}`
  })
}

export async function cancelLiveSession(session: LiveSession, reason: string | null): Promise<void> {
  await updateDoc(doc(firestore, SESSIONS, session.id), {
    status: 'cancelled',
    cancelled_reason: reason,
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  void notifyEnrolledStudents(session.course_id, {
    type: 'class_cancelled',
    title: 'Class cancelled',
    message: reason ? `${session.title} has been cancelled: ${reason}` : `${session.title} has been cancelled.`,
    related_id: session.id,
    action_url: `/live-session/${session.id}`
  })
}

export async function attachRecording(session: LiveSession, recordingUrl: string): Promise<void> {
  await updateDoc(doc(firestore, SESSIONS, session.id), {
    recording_url: recordingUrl,
    updated_at: new Date().toISOString()
  })

  void notifyEnrolledStudents(session.course_id, {
    type: 'class_recording_ready',
    title: 'Recording available',
    message: `The recording for ${session.title} is now available.`,
    related_id: session.id,
    action_url: `/live-session/${session.id}`
  })
}

export async function announceLiveNow(session: LiveSession): Promise<void> {
  void notifyEnrolledStudents(session.course_id, {
    type: 'class_live_now',
    title: 'Class is live now',
    message: `${session.title} is live now — join from your dashboard.`,
    related_id: session.id,
    action_url: `/live-session/${session.id}`
  })
}

export async function getLiveSession(sessionId: string): Promise<LiveSession | null> {
  const snap = await getDoc(doc(firestore, SESSIONS, sessionId))
  if (!snap.exists()) return null
  return toLiveSession(snap.id, snap.data())
}

// ---------------------------------------------------------------------
// Access control (client-side check, mirrored — and actually
// enforced — by firestore.rules; see that file's live_sessions/
// session_attendance blocks. This function exists so pages can show a
// clear "no access" message instead of just relying on a Firestore
// permission-denied error, per spec: "Never rely only on hiding the
// Join button" / rules must enforce it, not the UI.)
// ---------------------------------------------------------------------

export async function hasActiveEnrolment(studentUid: string, courseId: string): Promise<boolean> {
  // enrolments/{studentId}_{courseId} is the deterministic id already
  // used by src/pages/admin/AdminPayments.tsx — reading it directly by
  // path (rather than a `where` query) is exactly what lets
  // firestore.rules check the same fact server-side.
  const snap = await getDoc(doc(firestore, 'enrolments', `${studentUid}_${courseId}`))
  return snap.exists() && snap.data().status === 'active'
}

// ---------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------

export async function listSessionsForTutor(tutorId: string): Promise<LiveSession[]> {
  const q = query(collection(firestore, SESSIONS), where('tutor_id', '==', tutorId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => toLiveSession(d.id, d.data()))
  rows.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return rows
}

export async function listAllSessions(): Promise<LiveSession[]> {
  const snap = await getDocs(collection(firestore, SESSIONS))
  const rows = snap.docs.map((d) => toLiveSession(d.id, d.data()))
  rows.sort((a, b) => b.start_time.localeCompare(a.start_time))
  return rows
}

/**
 * Finds the single soonest published, not-yet-ended session across a
 * student's actively-enrolled courses, for the dashboard's
 * "Next Live Class" widget.
 *
 * Firestore's `in` operator caps at 10 values, and the enrolments
 * query below has no server-side order by course count, so a student
 * enrolled in more than 10 active courses will only have their first
 * 10 (by Firestore's default id order) considered here. That's a real
 * limit worth knowing about, not a hidden bug — flagged in the
 * delivery report.
 */
export async function getNextLiveSessionForStudent(studentUid: string): Promise<LiveSession | null> {
  const enrolmentSnap = await getDocs(
    query(collection(firestore, 'enrolments'), where('student_id', '==', studentUid), where('status', '==', 'active'))
  )
  const courseIds = enrolmentSnap.docs.map((d) => d.data().course_id as string).filter(Boolean).slice(0, 10)
  if (courseIds.length === 0) return null

  const sessionsSnap = await getDocs(
    query(collection(firestore, SESSIONS), where('course_id', 'in', courseIds), where('status', '==', 'published'))
  )

  const nowMs = Date.now()
  const candidates = sessionsSnap.docs
    .map((d) => toLiveSession(d.id, d.data()))
    .filter((s) => new Date(s.end_time).getTime() >= nowMs)

  candidates.sort((a, b) => a.start_time.localeCompare(b.start_time))
  return candidates[0] ?? null
}

export function subscribeToTutorSessions(
  tutorId: string,
  onChange: (sessions: LiveSession[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(firestore, SESSIONS), where('tutor_id', '==', tutorId))
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => toLiveSession(d.id, d.data()))
      rows.sort((a, b) => a.start_time.localeCompare(b.start_time))
      onChange(rows)
    },
    (error) => {
      console.error('[liveSessions] Tutor sessions listener error:', error)
      onError?.(error)
    }
  )
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

function attendanceDocId(sessionId: string, studentId: string): string {
  return `${sessionId}_${studentId}`
}

/**
 * Records that a student clicked "Join Live Session". This is a
 * self-reported signal ONLY — see SessionAttendanceRecord.source doc
 * comment. It does not overwrite a status a tutor/admin has already
 * set manually (merge only touches join metadata + a default status
 * on first write).
 */
export async function recordStudentJoinClick(
  sessionId: string,
  courseId: string,
  studentUid: string,
  studentName: string | null
): Promise<void> {
  const id = attendanceDocId(sessionId, studentUid)
  const attendanceRef = doc(firestore, ATTENDANCE, id)
  const now = new Date().toISOString()

  try {
    const existing = await getDoc(attendanceRef)

    if (existing.exists()) {
      await updateDoc(attendanceRef, { joined_at: now })
      return
    }
  } catch (err) {
    // A first-time student's attendance document may not exist yet.
    // The read can be denied because the read rule relies on resource.data.
    // Fall through to the security-checked self-reported create below.
    console.warn('Attendance lookup unavailable; attempting self-reported create:', err)
  }

  await setDoc(attendanceRef, {
    session_id: sessionId,
    course_id: courseId,
    student_id: studentUid,
    student_name: studentName,
    status: 'present',
    source: 'self_reported',
    joined_at: now,
    marked_by: null,
    marked_at: null
  })
}

/** Tutor/admin override of a student's attendance for a session. */
export async function setAttendanceStatus(
  sessionId: string,
  courseId: string,
  studentUid: string,
  studentName: string | null,
  status: AttendanceStatus,
  markedBy: string
): Promise<void> {
  const id = attendanceDocId(sessionId, studentUid)
  await setDoc(
    doc(firestore, ATTENDANCE, id),
    {
      session_id: sessionId,
      course_id: courseId,
      student_id: studentUid,
      student_name: studentName,
      status,
      source: 'tutor_marked',
      marked_by: markedBy,
      marked_at: new Date().toISOString()
    },
    { merge: true }
  )
}

export async function getAttendanceForStudentSession(
  sessionId: string,
  studentUid: string
): Promise<SessionAttendanceRecord | null> {
  const snap = await getDoc(doc(firestore, ATTENDANCE, attendanceDocId(sessionId, studentUid)))
  if (!snap.exists()) return null
  return toAttendance(snap.id, snap.data())
}

export async function listAttendanceForSession(sessionId: string): Promise<SessionAttendanceRecord[]> {
  const snap = await getDocs(query(collection(firestore, ATTENDANCE), where('session_id', '==', sessionId)))
  const rows = snap.docs.map((d) => toAttendance(d.id, d.data()))
  rows.sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? ''))
  return rows
}

// ---------------------------------------------------------------------
// Notification fan-out
// ---------------------------------------------------------------------

interface NotifyEnrolledStudentsInput {
  type: string
  title: string
  message: string
  related_id: string
  action_url: string
}

/**
 * Notifies every actively-enrolled student in a course. There is no
 * Cloud Function / backend in this project (see src/lib/notifications.ts
 * header comment), so this runs from whichever authenticated
 * tutor/admin client triggers the action — same pattern as
 * AdminPayments.tsx activating an enrolment. A student is notified
 * with a real recipient_uid (not a broadcast), matching the existing
 * "admin write authority" shape in src/lib/notifications.ts; the
 * matching firestore.rules addition allows an approved tutor to do the
 * same, but ONLY for the allow-listed live-session types and ONLY when
 * they own the referenced session (see firestore.rules).
 *
 * HONEST LIMITATION: the spec asks for reminders "24 hours before" and
 * "1 hour before" class. Those are point-in-time events that need
 * something to be running when nobody is looking — a scheduled Cloud
 * Function or cron job. This project has neither (pure client SPA), so
 * true 24h/1h-before reminders are not implemented here; building them
 * would require adding server infrastructure this project doesn't have
 * yet. What IS implemented and real: a notification the moment a
 * session is published/rescheduled/cancelled, and an admin/tutor
 * "Notify: live now" and "Notify: recording ready" action they trigger
 * by hand (see announceLiveNow / attachRecording above and the Tutor
 * Live Sessions page). See docs/LIVE-SESSIONS-DELIVERY-REPORT.md.
 */
async function notifyEnrolledStudents(courseId: string, input: NotifyEnrolledStudentsInput): Promise<void> {
  try {
    const snap = await getDocs(
      query(collection(firestore, 'enrolments'), where('course_id', '==', courseId), where('status', '==', 'active'))
    )
    await Promise.all(
      snap.docs.map((d) =>
        createNotification({
          recipient_uid: d.data().student_id as string,
          recipient_role: 'student',
          type: input.type,
          title: input.title,
          message: input.message,
          related_id: input.related_id,
          related_type: 'live_session',
          action_url: input.action_url
        })
      )
    )
  } catch (error) {
    // Never block the scheduling/cancel/reschedule action itself — same
    // contract as createNotification().
    console.error('[liveSessions] Failed to notify enrolled students:', error)
  }
}
