import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { cancelLiveSession, listAllSessions } from '@/lib/liveSessions'
import { computeLiveSessionPhase, type LiveSession, type LiveSessionPhase } from '@/types/liveSession'

// Spec §"LIVE SESSION ADMIN DASHBOARD". Read/audit-focused — scheduling
// itself happens from the Tutor Live Sessions page (an admin who needs
// to create a session can do so from there once signed in as an
// approved tutor, or this page can be extended with the same form if a
// pure-admin scheduling flow turns out to be needed).

type FilterKey = 'all' | 'live' | 'upcoming' | 'ended' | 'cancelled'

function phaseLabel(phase: LiveSessionPhase): string {
  switch (phase) {
    case 'starting_soon':
      return 'starting soon'
    default:
      return phase
  }
}

export default function AdminLiveSessions() {
  const [sessions, setSessions] = useState<LiveSession[]>([])
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  async function load() {
    setState('loading')
    try {
      const rows = await listAllSessions()
      setSessions(rows)
      setState('loaded')
    } catch (err) {
      console.error('Failed to load live sessions:', err)
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    return sessions.filter((s) => {
      const phase = computeLiveSessionPhase(s, now)
      if (filter === 'live' && phase !== 'live') return false
      if (filter === 'upcoming' && phase !== 'upcoming' && phase !== 'starting_soon') return false
      if (filter === 'ended' && phase !== 'ended') return false
      if (filter === 'cancelled' && phase !== 'cancelled') return false

      const term = search.trim().toLowerCase()
      if (!term) return true
      return [s.title, s.course_name, s.tutor_name, s.batch_label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [sessions, filter, search])

  async function handleCancel(session: LiveSession) {
    const reason = window.prompt('Reason for cancelling this class (optional):') ?? ''
    try {
      await cancelLiveSession(session, reason.trim() || null)
      load()
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <AdminNav active="live-sessions" />

      <h1 className="mt-6 font-display text-3xl">Live Sessions</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(['all', 'live', 'upcoming', 'ended', 'cancelled'] as FilterKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
              filter === key ? 'bg-gold/20 text-gold-bright' : 'text-slate-muted hover:text-parchment'
            }`}
          >
            {key}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by course, tutor, batch…"
          className="input ml-auto max-w-xs"
        />
      </div>

      {state === 'error' && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Unable to connect</p>
          <p className="mt-2 text-sm text-slate-muted">Please check your internet connection and try again.</p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'loaded' && filtered.length === 0 && (
        <p className="mt-8 text-sm text-slate-muted">No sessions match this view.</p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-muted">
            <tr>
              <th className="pb-2">Course / Batch</th>
              <th className="pb-2">Tutor</th>
              <th className="pb-2">Topic</th>
              <th className="pb-2">Start</th>
              <th className="pb-2">End</th>
              <th className="pb-2">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {state === 'loaded' &&
              filtered.map((session) => {
                const phase = computeLiveSessionPhase(session)
                return (
                  <tr key={session.id}>
                    <td className="py-2">
                      {session.course_name}
                      {session.batch_label ? ` · ${session.batch_label}` : ''}
                    </td>
                    <td className="py-2">{session.tutor_name ?? '—'}</td>
                    <td className="py-2">{session.topic ?? session.title}</td>
                    <td className="py-2">{new Date(session.start_time).toLocaleString()}</td>
                    <td className="py-2">{new Date(session.end_time).toLocaleTimeString()}</td>
                    <td className="py-2">
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs uppercase tracking-wide text-gold">
                        {session.status === 'draft' ? 'draft' : phaseLabel(phase)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {session.status === 'published' && phase !== 'ended' && phase !== 'cancelled' && (
                        <button
                          onClick={() => handleCancel(session)}
                          className="rounded-card border border-danger/50 px-2 py-1 text-xs font-semibold text-danger"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
