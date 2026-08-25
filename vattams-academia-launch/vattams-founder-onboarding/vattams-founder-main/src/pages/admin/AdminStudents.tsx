import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import IdentityCard from '@/components/IdentityCard'
import OnboardingLetter from '@/components/OnboardingLetter'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  approveAcademyStudent,
  listAcademyStudents,
  rejectAcademyStudent,
} from '@/lib/academyAdmin'
import { onboardStudent } from '@/lib/onboarding'
import type { AcademyStudent } from '@/types/academy'

type LoadState = 'loading' | 'loaded' | 'error'
type DocView = 'documents' | 'id-card' | 'letter' | null

export default function AdminStudents() {
  const { adminUser } = useAdminAuth()
  const [students, setStudents] = useState<AcademyStudent[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<AcademyStudent | null>(null)
  const [rejecting, setRejecting] = useState<AcademyStudent | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [docView, setDocView] = useState<{ student: AcademyStudent; view: DocView } | null>(null)

  // Same audit-field pattern as AdminTutors.tsx.
  const adminIdentifier = adminUser?.email ?? adminUser?.uid ?? 'unknown-admin'

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

  async function handleApprove(student: AcademyStudent) {
    setBusyId(student.id)
    setActionError(null)
    const { error } = await approveAcademyStudent(student.id, adminIdentifier)
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
    const { error } = await rejectAcademyStudent(rejecting.id, adminIdentifier, rejectionReason.trim())
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

  async function handleOnboard(student: AcademyStudent) {
    setBusyId(student.id)
    setActionError(null)
    const result = await onboardStudent(student.id, adminIdentifier)
    setBusyId(null)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setSelected(null)
    load()
  }

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

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

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
        <div className="mt-6 space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">{s.full_name || '—'}</p>
                <p className="text-slate-muted">{s.email ?? '—'}</p>
                {s.student_code && (
                  <p className="mt-1 text-xs text-gold-bright">
                    {s.student_code} · {s.student_id}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={s.status} />
                {s.student_code && (
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs uppercase tracking-wide text-success">
                    Onboarded
                  </span>
                )}
                <button onClick={() => setSelected(s)} className="btn-secondary text-xs">
                  View Profile
                </button>
                <button onClick={() => setDocView({ student: s, view: 'documents' })} className="btn-secondary text-xs">
                  View Documents
                </button>
                {s.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(s)}
                    disabled={busyId === s.id}
                    className="rounded-card bg-success px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Approve
                  </button>
                )}
                {s.status !== 'rejected' && (
                  <button
                    onClick={() => {
                      setRejecting(s)
                      setRejectionReason('')
                    }}
                    disabled={busyId === s.id}
                    className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                  >
                    Reject
                  </button>
                )}
                {s.status === 'approved' && !s.student_code && (
                  <button
                    onClick={() => handleOnboard(s)}
                    disabled={busyId === s.id}
                    className="rounded-card bg-gold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    {busyId === s.id ? 'Onboarding…' : 'Onboard'}
                  </button>
                )}
                {s.student_code && (
                  <>
                    <button onClick={() => setDocView({ student: s, view: 'id-card' })} className="btn-secondary text-xs">
                      View ID Card
                    </button>
                    <button onClick={() => setDocView({ student: s, view: 'letter' })} className="btn-secondary text-xs">
                      View Onboarding Letter
                    </button>
                  </>
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
              <Detail label="Student Code" value={selected.student_code} />
              <Detail label="Student ID" value={selected.student_id} />
              <Detail
                label="Onboarding Status"
                value={selected.onboarding_status ?? (selected.student_code ? 'active' : 'not_onboarded')}
              />
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
              placeholder="Let the student know why this application was rejected"
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

      {docView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setDocView(null)}
        >
          <div
            className="card w-full max-w-lg p-6 print:border-0 print:bg-transparent print:p-0 print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between print:hidden">
              <h2 className="font-display text-lg">
                {docView.view === 'documents' && 'Documents'}
                {docView.view === 'id-card' && 'ID Card'}
                {docView.view === 'letter' && 'Onboarding Letter'}
                {' — '}
                {docView.student.full_name}
              </h2>
              <button onClick={() => setDocView(null)} className="text-slate-muted hover:text-parchment">
                ✕
              </button>
            </div>

            {docView.view === 'documents' && (
              <p className="mt-4 text-sm text-slate-muted">
                No document upload feature exists yet in Student Registration, so there are no supporting documents on file
                for this student.
              </p>
            )}

            {docView.view === 'id-card' && docView.student.student_code && docView.student.student_id && (
              <div className="mt-4">
                <IdentityCard
                  role="Student"
                  name={docView.student.full_name}
                  code={docView.student.student_code}
                  permanentId={docView.student.student_id}
                  status={docView.student.onboarding_status ?? 'active'}
                  subtitle={docView.student.class}
                  issuedAt={docView.student.onboarded_at}
                />
              </div>
            )}

            {docView.view === 'letter' && docView.student.student_code && docView.student.student_id && (
              <div className="mt-4">
                <OnboardingLetter
                  role="Student"
                  name={docView.student.full_name}
                  code={docView.student.student_code}
                  permanentId={docView.student.student_id}
                  status={docView.student.onboarding_status ?? 'active'}
                  issuedAt={docView.student.onboarded_at ?? new Date().toISOString()}
                  subtitle={docView.student.class}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ value }: { value: string | null | undefined }) {
  const label = value ?? 'unknown'
  const positive = value === 'approved' || value === 'active'
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
