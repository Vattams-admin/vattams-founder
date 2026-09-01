import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNextLiveSessionForStudent } from '@/lib/liveSessions'
import { computeLiveSessionPhase } from '@/types/liveSession'
import type { LiveSession } from '@/types/liveSession'

// The most visible learning action on the student dashboard, per spec
// §"LIVE SESSION STUDENT DASHBOARD" — but it renders nothing rather
// than a placeholder when there's genuinely no upcoming class, so it
// never implies a class exists when one doesn't.

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '00:00:00'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export default function NextLiveSessionCard({ studentUid }: { studentUid: string }) {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [now, setNow] = useState(() => new Date())

  async function load() {
    setState('loading')
    try {
      const next = await getNextLiveSessionForStudent(studentUid)
      setSession(next)
      setState('loaded')
    } catch (err) {
      console.error('Failed to load next live session:', err)
      setState('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUid])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  if (state === 'loading') return null
  if (state === 'error') {
    return (
      <div className="card p-4 text-sm text-slate-muted">
        Unable to check for live classes right now.{' '}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    )
  }
  if (!session) return null

  const phase = computeLiveSessionPhase(session, now)
  const start = new Date(session.start_time)
  const msToStart = start.getTime() - now.getTime()

  return (
    <div className="card overflow-hidden p-5">
      <p className="font-display text-xs uppercase tracking-[0.25em] text-gold">
        {phase === 'live' ? '🔴 Live now' : 'Next live class'}
      </p>

      <h3 className="mt-2 font-display text-lg">{session.title}</h3>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {session.course_name && (
          <div>
            <dt className="text-slate-muted">Course</dt>
            <dd className="mt-0.5">{session.course_name}</dd>
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
            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </dd>
        </div>
      </dl>

      {phase === 'starting_soon' && (
        <p className="mt-3 font-mono text-2xl text-gold-bright">{formatCountdown(msToStart)}</p>
      )}

      <Link to={`/live-session/${session.id}`} className="btn-primary mt-4 inline-flex">
        {phase === 'live' ? 'Join Live Session' : phase === 'starting_soon' ? 'Join Live Session' : 'View class details'}
      </Link>
    </div>
  )
}
