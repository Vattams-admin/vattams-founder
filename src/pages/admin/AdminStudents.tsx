import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { listAcademyStudents } from '@/lib/academyAdmin'
import type { AcademyStudent } from '@/types/academy'

type LoadState = 'loading' | 'loaded' | 'error'

export default function AdminStudents() {
  const [students, setStudents] = useState<AcademyStudent[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AcademyStudent | null>(null)

  async function load() {
    setState('loading')
    setError(null)
    const { rows, error: loadError } = await listAcademyStudents()
    if (loadError) {
      setError(loadError)
      setState('error')
      return
    }
    setStudents(rows)
    setState('loaded')
  }

  useEffect(() => {
    load()
  }, [])

  const availableStatuses = useMemo(() => {
    const found = new Set<string>()
    for (const s of students) {
      if (s.status) found.add(s.status)
    }
    return Array.from(found)
  }, [students])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return students.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!term) return true
      const haystack = [s.full_name, s.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [students, search, statusFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="students" />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Students</h1>
        <button onClick={load} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input flex-1"
        />
        {availableStatuses.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="all">All statuses</option>
            {availableStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {state === 'error' && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Couldn&apos;t load students</p>
          <p className="mt-2 text-sm text-slate-muted">{error}</p>
          <button onClick={load} className="btn-secondary mt-4">
            Try again
          </button>
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'loaded' && students.length === 0 && (
        <div className="mt-8 card p-10 text-center">
          <p className="font-display text-lg">No students yet</p>
          <p className="mt-2 text-sm text-slate-muted">New academy registrations will appear here.</p>
        </div>
      )}

      {state === 'loaded' && students.length > 0 && filtered.length === 0 && (
        <div className="mt-8 card p-10 text-center">
          <p className="font-display text-lg">No students match your search</p>
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
            className="btn-secondary mt-4"
          >
            Clear search &amp; filters
          </button>
        </div>
      )}

      {state === 'loaded' && filtered.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-card border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.full_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-muted">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs uppercase tracking-wide text-gold-bright">
                      {s.status ?? 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-muted">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(s)} className="btn-secondary text-xs">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{selected.full_name}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-muted hover:text-parchment">
                ✕
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Detail label="Email" value={selected.email} />
              <Detail label="Status" value={selected.status} />
              <Detail label="Firebase UID" value={selected.id} />
              <Detail
                label="Created"
                value={selected.created_at ? new Date(selected.created_at).toLocaleString('en-IN') : null}
              />
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-muted">{label}</dt>
      <dd className="text-right">{value || '—'}</dd>
    </div>
  )
}