import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { approveAcademyTutor, listAcademyTutors, rejectAcademyTutor } from '@/lib/academyAdmin'
import type { AcademyTutor } from '@/types/academy'

type LoadState = 'loading' | 'loaded' | 'error'

export default function AdminTutors() {
  const { adminUser } = useAdminAuth()
  const [tutors, setTutors] = useState<AcademyTutor[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AcademyTutor | null>(null)
  const [rejecting, setRejecting] = useState<AcademyTutor | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Falls back to the Firebase admin's uid if email isn't set on the
  // account, for the approved_by / rejected_by audit fields.
  const adminIdentifier = adminUser?.email ?? adminUser?.uid ?? 'unknown-admin'

  async function load() {
    setState('loading')
    setError(null)
    const { rows, error: loadError } = await listAcademyTutors()
    if (loadError) {
      setError(loadError)
      setState('error')
      return
    }
    setTutors(rows)
    setState('loaded')
  }

  useEffect(() => {
    load()
  }, [])

  const availableStatuses = useMemo(() => {
    const found = new Set<string>()
    for (const t of tutors) if (t.status) found.add(t.status)
    return Array.from(found)
  }, [tutors])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tutors.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!term) return true
      const haystack = [t.full_name, t.email, t.qualification, t.expertise]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [tutors, search, statusFilter])

  async function handleApprove(tutor: AcademyTutor) {
    setBusyId(tutor.id)
    setActionError(null)
    const { error } = await approveAcademyTutor(tutor.id, adminIdentifier)
    setBusyId(null)
    if (error) {
      setActionError(error)
      return
    }
    setSelected(null)
    load()
  }

  async function handleReject() {
    if (!rejecting) return
    setBusyId(rejecting.id)
    setActionError(null)
    const { error } = await rejectAcademyTutor(rejecting.id, adminIdentifier, rejectionReason.trim())
    setBusyId(null)
    if (error) {
      setActionError(error)
      return
    }
    setRejecting(null)
    setRejectionReason('')
    setSelected(null)
    load()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="tutors" />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Tutors</h1>
        <button onClick={load} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, qualification, expertise…"
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

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      {state === 'error' && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Couldn&apos;t load tutors</p>
          <p className="mt-2 text-sm text-slate-muted">{error}</p>
          <button onClick={load} className="btn-secondary mt-4">
            Try again
          </button>
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'loaded' && tutors.length === 0 && (
        <div className="mt-8 card p-10 text-center">
          <p className="font-display text-lg">No tutors yet</p>
          <p className="mt-2 text-sm text-slate-muted">New tutor applications will appear here.</p>
        </div>
      )}

      {state === 'loaded' && tutors.length > 0 && filtered.length === 0 && (
        <div className="mt-8 card p-10 text-center">
          <p className="font-display text-lg">No tutors match your search</p>
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
        <div className="mt-6 space-y-3">
          {filtered.map((t) => (
            <div key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">{t.full_name}</p>
                <p className="text-slate-muted">
                  {t.qualification ?? 'No qualification listed'} · {t.expertise ?? 'No expertise listed'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={t.status} />
                <button onClick={() => setSelected(t)} className="btn-secondary text-xs">
                  View
                </button>
                {t.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(t)}
                    disabled={busyId === t.id}
                    className="rounded-card bg-success px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Approve
                  </button>
                )}
                {t.status !== 'rejected' && (
                  <button
                    onClick={() => {
                      setRejecting(t)
                      setRejectionReason('')
                    }}
                    disabled={busyId === t.id}
                    className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{selected.full_name}</h2>
              <button onClick={() => setSelected(null)} className="text-slate-muted hover:text-parchment">
                ✕
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Detail label="Email" value={selected.email} />
              <Detail label="Qualification" value={selected.qualification} />
              <Detail label="Expertise" value={selected.expertise} />
              <Detail label="Introduction" value={selected.introduction} />
              <Detail label="Status" value={selected.status} />
              <Detail label="Firebase UID" value={selected.id} />
              {selected.rejection_reason && <Detail label="Rejection reason" value={selected.rejection_reason} />}
              <Detail
                label="Created"
                value={selected.created_at ? new Date(selected.created_at).toLocaleString('en-IN') : null}
              />
            </dl>
          </div>
        </div>
      )}

      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRejecting(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl">Reject {rejecting.full_name}</h2>
            <label htmlFor="reason" className="mt-4 block text-sm font-medium">
              Rejection reason
            </label>
            <textarea
              id="reason"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Let the tutor know why this application was rejected"
              className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={busyId === rejecting.id || !rejectionReason.trim()}
                className="rounded-card border border-danger/50 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
              >
                {busyId === rejecting.id ? 'Rejecting…' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ value }: { value: string | null | undefined }) {
  const label = value ?? 'unknown'
  const positive = value === 'approved'
  const negative = value === 'rejected'

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
        positive
          ? 'bg-success/20 text-success'
          : negative
          ? 'bg-danger/20 text-danger'
          : 'bg-gold/20 text-gold'
      }`}
    >
      {label}
    </span>
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