import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { approveAcademyTutor, listAcademyTutors, rejectAcademyTutor } from '@/lib/academyAdmin'
import type { AcademyTutor } from '@/types/academy'
import type { Payment } from '@/types/database'
import { decideTutorRegistrationPayment, getTutorRegistrationPayment } from '@/lib/tutorPayments'
import { getTutorOnboardingReadiness, type TutorOnboardingReadiness } from '@/lib/tutorOnboardingGate'
import { reviewTutorOnboardingDocument } from '@/lib/tutorOnboardingDocuments'
import { REQUIRED_TUTOR_ONBOARDING_DOCUMENTS, type TutorOnboardingDocumentType } from '@/types/tutorOnboarding'
import { onboardTutor } from '@/lib/onboarding'
import { sumTutorEarnings } from '@/lib/tutorEarnings'

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

  // Registration payment status, keyed by tutor id — fetched once
  // alongside the tutor list so the row list can show a clear
  // "tutor registration payment" status per Part D, without a separate
  // click into each tutor's detail view.
  const [paymentByTutorId, setPaymentByTutorId] = useState<Record<string, Payment | null>>({})

  // Detail-modal-only state: onboarding documents + readiness are only
  // fetched for the currently-selected tutor (would be an unnecessary
  // number of reads to fetch for every row in the list).
  const [detailLoading, setDetailLoading] = useState(false)
  const [readiness, setReadiness] = useState<TutorOnboardingReadiness | null>(null)
  const [rejectingDocument, setRejectingDocument] = useState<TutorOnboardingDocumentType | null>(null)
  const [documentRejectionReason, setDocumentRejectionReason] = useState('')
  const [documentBusyType, setDocumentBusyType] = useState<TutorOnboardingDocumentType | null>(null)
  const [onboardBusy, setOnboardBusy] = useState(false)
  const [onboardResultMessage, setOnboardResultMessage] = useState<string | null>(null)

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

    // Fetch each tutor's ₹500 registration payment status in parallel —
    // exact deterministic doc lookup (tutor_registration_{uid}), same
    // pattern as everywhere else this payment is read.
    const entries = await Promise.all(
      rows.map(async (t) => [t.id, await getTutorRegistrationPayment(t.id)] as const)
    )
    setPaymentByTutorId(Object.fromEntries(entries))
  }

  useEffect(() => {
    load()
  }, [])

  const [earnings, setEarnings] = useState<{ total: number; count: number } | null>(null)

  async function loadDetail(tutor: AcademyTutor) {
    setDetailLoading(true)
    setOnboardResultMessage(null)
    try {
      const result = await getTutorOnboardingReadiness(tutor.id, tutor.status)
      setReadiness(result)
    } catch (err) {
      console.error('Failed to load onboarding readiness:', err)
      setReadiness(null)
    } finally {
      setDetailLoading(false)
    }
    // Best-effort, separate from the readiness load above so a failure
    // here never blocks the onboarding-review UI — see sumTutorEarnings()
    // in src/lib/tutorEarnings.ts (reads the tutor_earnings ledger
    // written by AdminPayments.tsx on every approved course payment for
    // a course with this tutor assigned).
    try {
      setEarnings(await sumTutorEarnings(tutor.id))
    } catch (err) {
      console.error('Failed to load tutor earnings:', err)
      setEarnings(null)
    }
  }

  function openDetail(tutor: AcademyTutor) {
    setSelected(tutor)
    setReadiness(null)
    setEarnings(null)
    void loadDetail(tutor)
  }

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

  function isPaymentVerified(tutorId: string): boolean {
    return paymentByTutorId[tutorId]?.status === 'approved'
  }

  async function handleApprove(tutor: AcademyTutor) {
    // Client-side gate for a clear message — the real enforcement is
    // firestore.rules' tutorApprovalGateOk(), which blocks this write
    // server-side regardless of what the UI does.
    if (!isPaymentVerified(tutor.id)) {
      setActionError('This tutor\u2019s ₹500 registration payment must be verified before you can approve them.')
      return
    }
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

  async function handleDecidePayment(status: 'approved' | 'rejected') {
    if (!selected) return
    const payment = paymentByTutorId[selected.id]
    if (!payment) return
    setBusyId(selected.id)
    setActionError(null)
    const note = status === 'rejected' ? window.prompt('Rejection reason (shown to the tutor):', '') : null
    if (status === 'rejected' && note === null) {
      setBusyId(null)
      return
    }
    const { error } = await decideTutorRegistrationPayment(payment, status, adminIdentifier, note)
    setBusyId(null)
    if (error) {
      setActionError(error)
      return
    }
    await load()
    await loadDetail(selected)
  }

  async function handleReviewDocument(status: 'verified' | 'rejected') {
    if (!selected || !rejectingDocument) return
    const documentType = rejectingDocument
    setDocumentBusyType(documentType)
    const { error } = await reviewTutorOnboardingDocument(
      selected.id,
      documentType,
      status,
      adminIdentifier,
      status === 'rejected' ? documentRejectionReason.trim() : null
    )
    setDocumentBusyType(null)
    if (error) {
      setActionError(error)
      return
    }
    setRejectingDocument(null)
    setDocumentRejectionReason('')
    await loadDetail(selected)
  }

  async function handleVerifyDocument(documentType: TutorOnboardingDocumentType) {
    if (!selected) return
    setDocumentBusyType(documentType)
    const { error } = await reviewTutorOnboardingDocument(selected.id, documentType, 'verified', adminIdentifier, null)
    setDocumentBusyType(null)
    if (error) {
      setActionError(error)
      return
    }
    await loadDetail(selected)
  }

  async function handleOnboard() {
    if (!selected) return
    setOnboardBusy(true)
    setOnboardResultMessage(null)
    const result = await onboardTutor(selected.id, adminIdentifier)
    setOnboardBusy(false)
    if (result.error) {
      setOnboardResultMessage(result.error)
      return
    }
    setOnboardResultMessage(
      result.alreadyOnboarded
        ? `Already onboarded — Employee Code ${result.employeeOrStudentCode}, Tutor ID ${result.permanentId}.`
        : `Onboarded — Employee Code ${result.employeeOrStudentCode}, Tutor ID ${result.permanentId}.`
    )
    await load()
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
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <PaymentStatusPill payment={paymentByTutorId[t.id]} />
                  {t.employee_code && (
                    <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-success">
                      Onboarded — {t.employee_code}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={t.status} />
                <button onClick={() => openDetail(t)} className="btn-secondary text-xs">
                  View
                </button>
                {t.status !== 'approved' && (
                  <button
                    onClick={() => handleApprove(t)}
                    disabled={busyId === t.id || !isPaymentVerified(t.id)}
                    title={!isPaymentVerified(t.id) ? 'Registration payment must be verified first' : undefined}
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
          <div className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
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

            {/* Part D — ₹500 registration payment status + actions */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-display text-sm uppercase tracking-wide text-gold">Registration payment</h3>
              <div className="mt-2 flex items-center justify-between text-sm">
                <PaymentStatusPill payment={paymentByTutorId[selected.id]} />
                {paymentByTutorId[selected.id]?.utr_reference && (
                  <span className="text-xs text-slate-muted">
                    UTR: {paymentByTutorId[selected.id]?.utr_reference}
                  </span>
                )}
              </div>
              {paymentByTutorId[selected.id]?.status === 'submitted' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleDecidePayment('approved')}
                    disabled={busyId === selected.id}
                    className="rounded-card bg-success px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Verify payment
                  </button>
                  <button
                    onClick={() => handleDecidePayment('rejected')}
                    disabled={busyId === selected.id}
                    className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                  >
                    Reject payment
                  </button>
                </div>
              )}
              {!paymentByTutorId[selected.id] && (
                <p className="mt-2 text-xs text-slate-muted">Tutor hasn&apos;t started the ₹500 payment yet.</p>
              )}
            </div>

            {/* Course revenue earnings — accrued tutor_earnings ledger rows
                (see src/lib/tutorEarnings.ts), written automatically by
                AdminPayments.tsx whenever an approved course payment's
                course has this tutor assigned (Course.instructor_tutor_id).
                This is accrued, not yet-necessarily-paid-out — actually
                transferring money to the tutor still happens outside the
                app, same as the ₹500 registration fee above. */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-display text-sm uppercase tracking-wide text-gold">Course revenue (accrued)</h3>
              {earnings === null ? (
                <p className="mt-2 text-xs text-slate-muted">Loading…</p>
              ) : earnings.count === 0 ? (
                <p className="mt-2 text-xs text-slate-muted">
                  No accrued course-payment earnings yet. This only fills in once a course lists this tutor as
                  its assigned instructor (Admin → Courses) and a student payment for that course is approved.
                </p>
              ) : (
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-gold-bright">₹{earnings.total.toLocaleString('en-IN')}</span>{' '}
                  <span className="text-slate-muted">across {earnings.count} approved payment{earnings.count === 1 ? '' : 's'}</span>
                </p>
              )}
            </div>

            {/* Part D — onboarding document review */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-display text-sm uppercase tracking-wide text-gold">Onboarding documents</h3>
              {detailLoading && <p className="mt-2 text-xs text-slate-muted">Loading…</p>}
              {!detailLoading && readiness && (
                <div className="mt-2 space-y-2">
                  {REQUIRED_TUTOR_ONBOARDING_DOCUMENTS.map((def) => {
                    const document = readiness.documentsByType[def.type]
                    const busy = documentBusyType === def.type
                    return (
                      <div key={def.type} className="rounded-card border border-white/10 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-parchment">{def.label}</span>
                          <DocumentStatusPill status={document?.status ?? null} />
                        </div>
                        {document?.rejection_reason && (
                          <p className="mt-1 text-danger">Rejected: {document.rejection_reason}</p>
                        )}
                        {document && document.status !== 'verified' && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => handleVerifyDocument(def.type)}
                              disabled={busy}
                              className="rounded-card bg-success px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-60"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => {
                                setRejectingDocument(def.type)
                                setDocumentRejectionReason('')
                              }}
                              disabled={busy}
                              className="rounded-card border border-danger/50 px-2.5 py-1 text-[11px] font-semibold text-danger disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {!document && <p className="mt-1 text-slate-muted">Not uploaded yet.</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Part D — onboard action, gated with a clear blocked reason */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-display text-sm uppercase tracking-wide text-gold">Onboarding</h3>
              {selected.employee_code && selected.tutor_id ? (
                <div className="mt-2 text-sm">
                  <p>Employee Code: <span className="font-medium">{selected.employee_code}</span></p>
                  <p>Tutor ID: <span className="font-medium">{selected.tutor_id}</span></p>
                  <p className="mt-1 text-xs text-slate-muted">
                    Onboarding status: {selected.onboarding_status ?? 'active'}
                  </p>
                </div>
              ) : (
                <>
                  {readiness && !readiness.canOnboard && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-muted">
                      {readiness.blockedReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={handleOnboard}
                    disabled={onboardBusy || !readiness?.canOnboard}
                    className="btn-primary mt-3 text-sm disabled:opacity-60"
                  >
                    {onboardBusy ? 'Onboarding…' : 'Complete onboarding'}
                  </button>
                </>
              )}
              {onboardResultMessage && <p className="mt-2 text-sm text-parchment">{onboardResultMessage}</p>}
            </div>
          </div>
        </div>
      )}

      {rejectingDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRejectingDocument(null)}
        >
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl">Reject document</h2>
            <label htmlFor="doc-reason" className="mt-4 block text-sm font-medium">
              Rejection reason
            </label>
            <textarea
              id="doc-reason"
              rows={3}
              value={documentRejectionReason}
              onChange={(e) => setDocumentRejectionReason(e.target.value)}
              placeholder="Let the tutor know why this document was rejected"
              className="mt-1 w-full rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectingDocument(null)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleReviewDocument('rejected')}
                disabled={documentBusyType === rejectingDocument || !documentRejectionReason.trim()}
                className="rounded-card border border-danger/50 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
              >
                {documentBusyType === rejectingDocument ? 'Rejecting…' : 'Confirm rejection'}
              </button>
            </div>
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

function PaymentStatusPill({ payment }: { payment: Payment | null | undefined }) {
  const status = payment?.status ?? 'not started'
  const positive = status === 'approved'
  const negative = status === 'rejected'

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        positive
          ? 'bg-success/20 text-success'
          : negative
          ? 'bg-danger/20 text-danger'
          : 'bg-white/10 text-slate-muted'
      }`}
    >
      ₹500 fee: {status}
    </span>
  )
}

function DocumentStatusPill({ status }: { status: string | null }) {
  const label = status ?? 'not uploaded'
  const verified = status === 'verified'
  const rejected = status === 'rejected'

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        verified ? 'bg-success/20 text-success' : rejected ? 'bg-danger/20 text-danger' : 'bg-gold/20 text-gold'
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
