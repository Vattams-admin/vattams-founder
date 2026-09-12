import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getAttendanceForStudentSession,
  getLiveSession,
  hasActiveEnrolment,
  recordStudentJoinClick
} from '@/lib/liveSessions'
import { computeLiveSessionPhase } from '@/types/liveSession'
import type { LiveSession, SessionAttendanceRecord } from '@/types/liveSession'

// Student join screen — spec §"LIVE SESSION JOIN EXPERIENCE".
//
// ACCESS CONTROL: the checks below (signed in, session exists, session
// published, active enrolment in the session's course) are a UX
// convenience so a student sees a clear message instead of a raw
// Firestore error. They are NOT the real enforcement — per spec
// ("Never rely only on hiding the Join button"), the actual
// authorization is firestore.rules' `live_sessions` read rule, which
// requires the exact same facts (published + enrolments/{uid}_{courseId}
// active) evaluated on Google's servers, not this component. A student
// who edits the sessionId in the URL is stopped by the security rule
// denying the read, not by this page's logic.

type ViewState = 'loading' | 'ready' | 'not_found' | 'no_access' | 'error'

export default function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [session, setSession] = useState<LiveSession | null>(null)
  const [attendance, setAttendance] = useState<SessionAttendanceRecord | null>(null)
  const [state, setState] = useState<ViewState>('loading')
  const [now, setNow] = useState(() => new Date())
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { state: { redirectTo: `/live-session/${sessionId}` } })
      return
    }
    if (!sessionId) {
      setState('not_found')
      return
    }

    let cancelled = false
    ;(async () => {
      setState('loading')
      try {
        const found = await getLiveSession(sessionId)
        if (cancelled) return
        if (!found) {
          setState('not_found')
          return
        }

        if (found.status !== 'published') {
          // Not published yet (draft) or removed from the schedule —
          // a student should never see draft content, tutors/admins
          // handle this case from their own dashboards instead.
          setState('no_access')
          return
        }

        const enrolled = await hasActiveEnrolment(user.id, found.course_id)
        if (cancelled) return
        if (!enrolled) {
          setState('no_access')
          return
        }

        setSession(found)

        const existingAttendance = await getAttendanceForStudentSession(sessionId, user.id)
        if (cancelled) return
        setAttendance(existingAttendance)

        setState('ready')
      } catch (err) {
        console.error('Failed to load live session:', err)
        if (!cancelled) setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, user, authLoading, navigate])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  async function handleJoin() {
    if (!session || !user) return
    setJoining(true)
    try {
      await recordStudentJoinClick(
        session.id,
        session.course_id,
        user.id,
        user.displayName ?? null
      )
    } catch (err) {
      console.error('Failed to record join click:', err)
    } finally {
      setJoining(false)
    }

    navigate(`/live-classroom/${session.id}`)
  }

  if (state === 'loading' || authLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-slate-muted">Loading…</div>
  }

  if (state === 'not_found') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Session not found</h1>
        <p className="mt-3 text-slate-muted">This live class doesn't exist or may have been removed.</p>
        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (state === 'no_access') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">No access</h1>
        <p className="mt-3 text-slate-muted">
          You don't have access to this live class. You may not be enrolled in the course it belongs to, or the
          class hasn't been published yet.
        </p>
        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </div>
    )
  }

  if (state === 'error' || !session) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-danger">Unable to connect</h1>
        <p className="mt-3 text-slate-muted">Please check your internet connection and try again.</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-6">
          Retry
        </button>
      </div>
    )
  }

  const phase = computeLiveSessionPhase(session, now)
  const start = new Date(session.start_time)
  const end = new Date(session.end_time)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-display text-xs uppercase tracking-[0.25em] text-gold">VATTAMS ACADEMIA</p>
      <h1 className="mt-2 font-display text-2xl">{session.course_name ?? 'Live Class'}</h1>
      <p className="mt-1 text-sm text-slate-muted">{session.title}</p>

      <div className="mt-6 card p-6">
        {phase === 'cancelled' && (
          <div>
            <p className="font-display text-xl text-danger">Class cancelled</p>
            {session.cancelled_reason && <p className="mt-2 text-sm text-slate-muted">{session.cancelled_reason}</p>}
          </div>
        )}

        {phase === 'upcoming' && (
          <div>
            <p className="font-display text-lg">Upcoming live session</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {session.topic && (
                <div>
                  <dt className="text-slate-muted">Topic</dt>
                  <dd className="mt-0.5">{session.topic}</dd>
                </div>
              )}
              {session.tutor_name && (
                <div>
                  <dt className="text-slate-muted">Tutor</dt>
                  <dd className="mt-0.5">{session.tutor_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-muted">Date</dt>
                <dd className="mt-0.5">{start.toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Time</dt>
                <dd className="mt-0.5">
                  {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </dd>
              </div>
            </dl>
            <button className="btn-secondary mt-6 cursor-not-allowed opacity-60" disabled>
              Join when live
            </button>
          </div>
        )}

        {phase === 'starting_soon' && (
          <div>
            <p className="font-display text-lg text-gold-bright">Starting soon</p>
            <p className="mt-2 text-3xl font-mono">
              {(() => {
                const ms = start.getTime() - now.getTime()
                const totalSeconds = Math.max(0, Math.floor(ms / 1000))
                const h = Math.floor(totalSeconds / 3600)
                const m = Math.floor((totalSeconds % 3600) / 60)
                const s = totalSeconds % 60
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
              })()}
            </p>
            <p className="mt-4 text-sm text-slate-muted">
              {session.topic ?? session.title} with {session.tutor_name ?? 'your tutor'}
            </p>
          </div>
        )}

        {phase === 'live' && (
          <div>
            <p className="font-display text-xl text-danger">🔴 Live now</p>
            <p className="mt-2 text-sm text-slate-muted">
              {session.topic ?? session.title} · {session.tutor_name ?? 'your tutor'} ·{' '}
              {Math.round((end.getTime() - start.getTime()) / 60000)} min session
            </p>
            <p className="mt-4 text-xs text-slate-muted">
              Join your VATTAMS ACADEMIA live classroom.
            </p>
            <button onClick={handleJoin} disabled={joining} className="btn-primary mt-4">
              Join Live Session
            </button>
            {attendance?.joined_at && (
              <p className="mt-2 text-xs text-slate-muted">
                Join recorded at {new Date(attendance.joined_at).toLocaleTimeString()} (self-reported).
              </p>
            )}
          </div>
        )}

        {phase === 'ended' && (
          <div>
            <p className="font-display text-lg">Session ended</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {session.recording_url ? (
                <a href={session.recording_url} target="_blank" rel="noreferrer" className="btn-primary">
                  Watch recording
                </a>
              ) : (
                <p className="text-sm text-slate-muted">Recording not available.</p>
              )}
              {session.course_slug && (
                <Link to={`/learn/${session.course_slug}`} className="btn-secondary">
                  Continue learning
                </Link>
              )}
            </div>
          </div>
        )}

        {session.session_notes && phase !== 'cancelled' && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-muted">Session notes</p>
            <p className="mt-1 whitespace-pre-line text-sm">{session.session_notes}</p>
          </div>
        )}

        {session.materials.length > 0 && phase !== 'cancelled' && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-wide text-slate-muted">Materials</p>
            <ul className="mt-2 space-y-1 text-sm">
              {session.materials.map((m, i) => (
                <li key={i}>
                  <a href={m.url} target="_blank" rel="noreferrer" className="underline hover:text-gold-bright">
                    {m.name || m.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
