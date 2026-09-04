import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import {
  attachRecording,
  announceLiveNow,
  cancelLiveSession,
  createLiveSession,
  listAttendanceForSession,
  publishLiveSession,
  rescheduleLiveSession,
  setAttendanceStatus,
  subscribeToTutorSessions,
  validateLiveSessionInput,
  type LiveSessionInput
} from '@/lib/liveSessions'
import {
  ATTENDANCE_STATUS_LABEL,
  computeLiveSessionPhase,
  type AttendanceStatus,
  type LiveSession,
  type MeetingProvider,
  type SessionAttendanceRecord
} from '@/types/liveSession'

// Spec §"LIVE SESSION TUTOR DASHBOARD" + §"LIVE SESSION SCHEDULING".
//
// NOTE ON TUTOR↔COURSE ASSIGNMENT: this project has no collection that
// records which tutor teaches which course (see src/lib/academyAdmin.ts —
// tutor documents carry a free-text `subjects` field, not a course_id
// list). So the course dropdown below lists every course, and any
// approved tutor can currently schedule a session against any course.
// That is an honest gap, not a hidden one — see
// docs/LIVE-SESSIONS-DELIVERY-REPORT.md for what a real
// tutor-course-assignment collection would need before this should be
// tightened.

interface CourseOption {
  id: string
  name: string
  slug: string | null
}

const emptyForm = {
  course_id: '',
  batch_label: '',
  title: '',
  topic: '',
  description: '',
  start_time: '',
  end_time: '',
  meeting_provider: 'google_meet' as MeetingProvider,
  meeting_url: '',
  session_notes: '',
  materials_raw: ''
}

function parseMaterials(raw: string): { name: string; url: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, url] = line.split('|').map((p) => p.trim())
      return { name: name || '', url: url || name || '' }
    })
}

export default function TutorLiveSessions() {
  const { user, loading: authLoading } = useAuth()
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attendanceById, setAttendanceById] = useState<Record<string, SessionAttendanceRecord[]>>({})

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const snap = await getDocs(
          query(
            collection(firestore, 'courses'),
            where('is_published', '==', true)
          )
        )
        setCourses(
          snap.docs.map((d) => ({
            id: d.id,
            name: (d.data().name as string) ?? d.id,
            slug: (d.data().slug as string) ?? null
          }))
        )
        setLoadState('loaded')
      } catch (err) {
        console.error('Failed to load courses:', err)
        setLoadState('error')
      }
    })()
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToTutorSessions(user.id, setSessions, (err) => console.error(err))
    return unsub
  }, [user])

  const grouped = useMemo(() => {
    const now = new Date()
    const groups: Record<'live' | 'today_upcoming' | 'upcoming' | 'completed' | 'other', LiveSession[]> = {
      live: [],
      today_upcoming: [],
      upcoming: [],
      completed: [],
      other: []
    }
    for (const s of sessions) {
      const phase = computeLiveSessionPhase(s, now)
      if (phase === 'live') groups.live.push(s)
      else if (phase === 'ended') groups.completed.push(s)
      else if (phase === 'starting_soon' || phase === 'upcoming') {
        const start = new Date(s.start_time)
        const isToday = start.toDateString() === now.toDateString()
        if (isToday) groups.today_upcoming.push(s)
        else groups.upcoming.push(s)
      } else {
        groups.other.push(s)
      }
    }
    return groups
  }, [sessions])

  function updateForm<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSchedule(e: FormEvent, status: 'draft' | 'published') {
    e.preventDefault()
    if (!user) return

    const course = courses.find((c) => c.id === form.course_id)
    const input: LiveSessionInput = {
      course_id: form.course_id,
      course_name: course?.name ?? null,
      course_slug: course?.slug ?? null,
      batch_label: form.batch_label.trim() || null,
      tutor_id: user.id,
      tutor_name: user.displayName ?? null,
      title: form.title.trim(),
      topic: form.topic.trim() || null,
      description: form.description.trim() || null,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : '',
      end_time: form.end_time ? new Date(form.end_time).toISOString() : '',
      meeting_provider: form.meeting_provider,
      meeting_url: form.meeting_url.trim() || null,
      session_notes: form.session_notes.trim() || null,
      materials: parseMaterials(form.materials_raw)
    }

    const problems = validateLiveSessionInput(input)
    if (problems.length > 0) {
      setFormErrors(problems)
      return
    }

    setFormErrors([])
    setSaving(true)
    try {
      await createLiveSession(input, user.id, status)
      setForm(emptyForm)
    } catch (err) {
      console.error('Failed to create live session:', err)
      setFormErrors([
        err instanceof Error ? err.message : String(err),
      ])
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(session: LiveSession) {
    try {
      await publishLiveSession(session)
    } catch (err) {
      console.error('Failed to publish session:', err)
    }
  }

  async function handleCancel(session: LiveSession) {
    const reason = window.prompt('Reason for cancelling this class (optional):') ?? ''
    try {
      await cancelLiveSession(session, reason.trim() || null)
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }

  async function handleReschedule(session: LiveSession) {
    const newStart = window.prompt('New start time (e.g. 2026-08-28T19:00):', session.start_time.slice(0, 16))
    if (!newStart) return
    const newEnd = window.prompt('New end time:', session.end_time.slice(0, 16))
    if (!newEnd || !user) return
    try {
      await rescheduleLiveSession(session, new Date(newStart).toISOString(), new Date(newEnd).toISOString(), user.id)
    } catch (err) {
      console.error('Failed to reschedule session:', err)
    }
  }

  async function handleAttachRecording(session: LiveSession) {
    const url = window.prompt('Recording URL:')
    if (!url) return
    try {
      await attachRecording(session, url.trim())
    } catch (err) {
      console.error('Failed to attach recording:', err)
    }
  }

  async function handleAnnounceLive(session: LiveSession) {
    try {
      await announceLiveNow(session)
    } catch (err) {
      console.error('Failed to announce live session:', err)
    }
  }

  async function toggleAttendance(session: LiveSession) {
    if (expandedId === session.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(session.id)
    if (!attendanceById[session.id]) {
      try {
        const rows = await listAttendanceForSession(session.id)
        setAttendanceById((prev) => ({ ...prev, [session.id]: rows }))
      } catch (err) {
        console.error('Failed to load attendance:', err)
      }
    }
  }

  async function markAttendance(session: LiveSession, record: SessionAttendanceRecord, status: AttendanceStatus) {
    if (!user) return
    try {
      await setAttendanceStatus(session.id, session.course_id, record.student_id, record.student_name, status, user.id)
      setAttendanceById((prev) => ({
        ...prev,
        [session.id]: prev[session.id].map((r) => (r.id === record.id ? { ...r, status } : r))
      }))
    } catch (err) {
      console.error('Failed to update attendance:', err)
    }
  }

  if (authLoading) return <div className="mx-auto max-w-5xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/tutor/live-sessions' }} replace />

  function renderSessionCard(session: LiveSession) {
    const phase = computeLiveSessionPhase(session)
    const start = new Date(session.start_time)
    return (
      <div key={session.id} className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{session.title}</p>
            <p className="text-xs text-slate-muted">
              {session.course_name} {session.batch_label ? `· ${session.batch_label}` : ''} ·{' '}
              {start.toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs uppercase tracking-wide text-gold">
            {session.status === 'draft' ? 'Draft' : phase.replace('_', ' ')}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {session.status === 'draft' && (
            <button onClick={() => handlePublish(session)} className="btn-secondary text-xs">
              Publish
            </button>
          )}
          {session.status === 'published' && phase !== 'ended' && phase !== 'cancelled' && (
            <>
              <button onClick={() => handleReschedule(session)} className="btn-secondary text-xs">
                Reschedule
              </button>
              <button onClick={() => handleCancel(session)} className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger">
                Cancel
              </button>
            </>
          )}
          {phase === 'live' && (
            <button onClick={() => handleAnnounceLive(session)} className="btn-secondary text-xs">
              Notify students: live now
            </button>
          )}
          {phase === 'ended' && !session.recording_url && (
            <button onClick={() => handleAttachRecording(session)} className="btn-secondary text-xs">
              Attach recording
            </button>
          )}
          <button onClick={() => toggleAttendance(session)} className="btn-secondary text-xs">
            {expandedId === session.id ? 'Hide attendance' : 'View attendance'}
          </button>
        </div>

        {expandedId === session.id && (
          <div className="mt-3 border-t border-white/10 pt-3">
            {!attendanceById[session.id] && <p className="text-xs text-slate-muted">Loading attendance…</p>}
            {attendanceById[session.id]?.length === 0 && (
              <p className="text-xs text-slate-muted">No students have joined or been marked yet.</p>
            )}
            {attendanceById[session.id]?.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                <span>
                  {record.student_name ?? record.student_id}
                  {record.source === 'self_reported' && (
                    <span className="ml-1 text-slate-muted">(self-reported)</span>
                  )}
                </span>
                <select
                  value={record.status ?? ''}
                  onChange={(e) => markAttendance(session, record, e.target.value as AttendanceStatus)}
                  className="input w-32 py-1 text-xs"
                >
                  <option value="" disabled>
                    Set status
                  </option>
                  {Object.entries(ATTENDANCE_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Live Sessions</h1>

      <section className="mt-8 card p-6">
        <h2 className="font-display text-lg">Schedule a class</h2>
        {loadState === 'error' && (
          <p className="mt-2 text-sm text-danger">Unable to load courses. Please check your connection.</p>
        )}
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => handleSchedule(e, 'published')}>
          <select
            value={form.course_id}
            onChange={(e) => updateForm('course_id', e.target.value)}
            className="input sm:col-span-2"
            required
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={form.batch_label}
            onChange={(e) => updateForm('batch_label', e.target.value)}
            placeholder="Batch label (optional, e.g. Weekday Evening)"
            className="input"
          />
          <input
            value={form.title}
            onChange={(e) => updateForm('title', e.target.value)}
            placeholder="Session title"
            className="input"
            required
          />
          <input
            value={form.topic}
            onChange={(e) => updateForm('topic', e.target.value)}
            placeholder="Topic"
            className="input"
          />
          <select
            value={form.meeting_provider}
            onChange={(e) => updateForm('meeting_provider', e.target.value as MeetingProvider)}
            className="input"
          >
            <option value="google_meet">Google Meet</option>
            <option value="zoom">Zoom</option>
            <option value="microsoft_teams">Microsoft Teams</option>
            <option value="external">Other / external</option>
          </select>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => updateForm('start_time', e.target.value)}
            className="input"
            required
          />
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => updateForm('end_time', e.target.value)}
            className="input"
            required
          />
          <input
            value={form.meeting_url}
            onChange={(e) => updateForm('meeting_url', e.target.value)}
            placeholder="Meeting URL"
            className="input sm:col-span-2"
          />
          <textarea
            value={form.description}
            onChange={(e) => updateForm('description', e.target.value)}
            placeholder="Description"
            className="input sm:col-span-2"
            rows={2}
          />
          <textarea
            value={form.session_notes}
            onChange={(e) => updateForm('session_notes', e.target.value)}
            placeholder="Session notes (shown to students)"
            className="input sm:col-span-2"
            rows={2}
          />
          <textarea
            value={form.materials_raw}
            onChange={(e) => updateForm('materials_raw', e.target.value)}
            placeholder={'Materials — one per line as: Name | https://link'}
            className="input sm:col-span-2"
            rows={2}
          />

          {formErrors.length > 0 && (
            <ul className="sm:col-span-2 list-disc pl-5 text-sm text-danger">
              {formErrors.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Publish class'}
            </button>
            <button type="button" disabled={saving} onClick={(e) => handleSchedule(e, 'draft')} className="btn-secondary">
              Save as draft
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg text-gold-bright">Live now</h2>
        <div className="mt-3 space-y-3">
          {grouped.live.length === 0 && <p className="text-sm text-slate-muted">No sessions live right now.</p>}
          {grouped.live.map(renderSessionCard)}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg text-gold-bright">Today</h2>
        <div className="mt-3 space-y-3">
          {grouped.today_upcoming.length === 0 && <p className="text-sm text-slate-muted">Nothing scheduled today.</p>}
          {grouped.today_upcoming.map(renderSessionCard)}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg text-gold-bright">Upcoming</h2>
        <div className="mt-3 space-y-3">
          {grouped.upcoming.length === 0 && <p className="text-sm text-slate-muted">No upcoming sessions.</p>}
          {grouped.upcoming.map(renderSessionCard)}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg text-gold-bright">Completed</h2>
        <div className="mt-3 space-y-3">
          {grouped.completed.length === 0 && <p className="text-sm text-slate-muted">No completed sessions yet.</p>}
          {grouped.completed.map(renderSessionCard)}
        </div>
      </section>

      {grouped.other.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-gold-bright">Drafts &amp; cancelled</h2>
          <div className="mt-3 space-y-3">{grouped.other.map(renderSessionCard)}</div>
        </section>
      )}
    </div>
  )
}
