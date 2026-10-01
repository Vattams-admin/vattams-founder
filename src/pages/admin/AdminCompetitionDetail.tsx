import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import AdminRoute from '@/components/AdminRoute'
import type { Course, Enrolment, Payment } from '@/types/database'
import { classifyFirestoreError, type ClassifiedFirestoreError } from '@/lib/firestoreErrors'
import { useSeo } from '@/hooks/useSeo'

type LoadState = 'loading' | 'loaded' | 'error'

type ParticipantRow = {
  enrolment: Enrolment
  payment: Payment | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function formatAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'

  return `₹${value.toLocaleString('en-IN')}`
}

export default function AdminCompetitionDetail() {
  const { id } = useParams<{ id: string }>()

  useSeo({
    title: 'Admin · Competition',
    noindex: true,
  })

  const [competition, setCompetition] = useState<Course | null>(null)
  const [enrolments, setEnrolments] = useState<Enrolment[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] =
    useState<ClassifiedFirestoreError | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    if (!id) {
      setLoadError(
        classifyFirestoreError(
          new Error('Missing competition ID.'),
          'AdminCompetitionDetail: missing competition ID',
        ),
      )
      setState('error')
      return
    }

    setState('loading')
    setLoadError(null)

    try {
      const courseSnapshot = await getDoc(doc(firestore, 'courses', id))

      if (!courseSnapshot.exists()) {
        throw new Error('Competition not found.')
      }

      const course = {
        id: courseSnapshot.id,
        ...courseSnapshot.data(),
      } as Course

      if (course.is_competition !== true) {
        throw new Error('The selected course is not marked as a competition.')
      }

      const [enrolmentSnapshot, paymentSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(firestore, 'enrolments'),
            where('course_id', '==', id),
          ),
        ),
        getDocs(
          query(
            collection(firestore, 'payments'),
            where('course_id', '==', id),
          ),
        ),
      ])

      setCompetition(course)

      setEnrolments(
        enrolmentSnapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as Enrolment,
        ),
      )

      setPayments(
        paymentSnapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as Payment,
        ),
      )

      setState('loaded')
    } catch (err) {
      setLoadError(
        classifyFirestoreError(err, 'AdminCompetitionDetail: load competition'),
      )
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const paymentsByStudent = useMemo(() => {
    const map = new Map<string, Payment>()

    for (const payment of payments) {
      if (!payment.student_id) continue

      const existing = map.get(payment.student_id)

      if (!existing) {
        map.set(payment.student_id, payment)
        continue
      }

      const existingTime = existing.created_at
        ? new Date(existing.created_at).getTime()
        : 0

      const currentTime = payment.created_at
        ? new Date(payment.created_at).getTime()
        : 0

      if (currentTime > existingTime) {
        map.set(payment.student_id, payment)
      }
    }

    return map
  }, [payments])

  const participants = useMemo<ParticipantRow[]>(() => {
    const term = search.trim().toLowerCase()

    return enrolments
      .map((enrolment) => ({
        enrolment,
        payment: enrolment.student_id
          ? paymentsByStudent.get(enrolment.student_id) ?? null
          : null,
      }))
      .filter(({ enrolment, payment }) => {
        if (!term) return true

        return [
          enrolment.student_id,
          enrolment.course_name,
          payment?.student_name,
          payment?.utr_reference,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => {
        const aName = a.payment?.student_name ?? a.enrolment.student_id ?? ''
        const bName = b.payment?.student_name ?? b.enrolment.student_id ?? ''

        return aName.localeCompare(bName)
      })
  }, [enrolments, paymentsByStudent, search])

  const enrolmentStats = useMemo(
    () => ({
      total: enrolments.length,
      active: enrolments.filter((item) => item.status === 'active').length,
      pending: enrolments.filter((item) => item.status === 'pending').length,
      revoked: enrolments.filter((item) => item.status === 'revoked').length,
    }),
    [enrolments],
  )

  const paymentStats = useMemo(
    () => ({
      pending: payments.filter((item) => item.status === 'pending').length,
      submitted: payments.filter((item) => item.status === 'submitted').length,
      approved: payments.filter((item) => item.status === 'approved').length,
      rejected: payments.filter((item) => item.status === 'rejected').length,
      collected: payments
        .filter((item) => item.status === 'approved')
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    }),
    [payments],
  )

  return (
    <AdminRoute>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <AdminNav active="competitions" />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/admin/competitions"
              className="text-sm text-slate-muted hover:text-gold"
            >
              ← Back to Competitions
            </Link>

            <h1 className="mt-3 font-display text-3xl">
              {competition?.name ?? 'Competition'}
            </h1>
          </div>

          <button onClick={load} className="btn-secondary text-sm">
            Refresh
          </button>
        </div>

        {state === 'loading' && (
          <p className="mt-8 text-sm text-slate-muted">
            Loading competition management data…
          </p>
        )}

        {state === 'error' && loadError && (
          <div className="mt-8 card border-danger/40 p-8 text-center">
            <p className="font-display text-lg text-danger">
              {loadError.headline}
            </p>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-muted">
              {loadError.detail}
            </p>

            <p className="mt-2 text-xs text-slate-muted">
              Firestore error code: {loadError.code ?? 'unknown'}
            </p>

            <button onClick={load} className="btn-secondary mt-4">
              Retry
            </button>
          </div>
        )}

        {state === 'loaded' && competition && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-muted">
                  Competition
                </p>
                <p className="mt-2 font-display text-lg">
                  {competition.name}
                </p>
                <p className="mt-1 text-xs text-slate-muted">
                  ID: {competition.id}
                </p>
              </div>

              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-muted">
                  Status
                </p>
                <p className="mt-2 font-display text-lg">
                  {competition.is_published ? 'Published' : 'Draft'}
                </p>
                <p className="mt-1 text-xs text-slate-muted">
                  /{competition.slug}
                </p>
              </div>

              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-muted">
                  Age Eligibility
                </p>
                <p className="mt-2 font-display text-lg">
                  {competition.min_age != null ||
                  competition.max_age != null
                    ? `${competition.min_age != null ? `${competition.min_age}+` : '—'}${
                        competition.max_age != null
                          ? ` / max ${competition.max_age}`
                          : ''
                      }`
                    : 'No restriction'}
                </p>
              </div>

              <div className="card p-5">
                <p className="text-xs uppercase tracking-wide text-slate-muted">
                  Base Fee
                </p>
                <p className="mt-2 font-display text-lg">
                  {competition.is_free
                    ? 'Free'
                    : formatAmount(competition.base_fee)}
                </p>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-2xl">Participants</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Total</p>
                  <p className="mt-2 font-display text-2xl">
                    {enrolmentStats.total}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Active</p>
                  <p className="mt-2 font-display text-2xl text-success">
                    {enrolmentStats.active}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Pending</p>
                  <p className="mt-2 font-display text-2xl text-gold">
                    {enrolmentStats.pending}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Revoked</p>
                  <p className="mt-2 font-display text-2xl text-danger">
                    {enrolmentStats.revoked}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-2xl">Payments</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-5">
                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Pending</p>
                  <p className="mt-2 font-display text-2xl">
                    {paymentStats.pending}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Submitted</p>
                  <p className="mt-2 font-display text-2xl">
                    {paymentStats.submitted}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Approved</p>
                  <p className="mt-2 font-display text-2xl text-success">
                    {paymentStats.approved}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Rejected</p>
                  <p className="mt-2 font-display text-2xl text-danger">
                    {paymentStats.rejected}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Approved Value</p>
                  <p className="mt-2 font-display text-2xl">
                    {formatAmount(paymentStats.collected)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl">
                    Participant Register
                  </h2>
                  <p className="mt-1 text-sm text-slate-muted">
                    Enrolments and their latest course payment record.
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student, ID, UTR…"
                  className="input sm:max-w-xs"
                />
              </div>

              {participants.length === 0 ? (
                <div className="card mt-4 p-8 text-center text-sm text-slate-muted">
                  No participants found.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto card">
                  <table className="min-w-[1000px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-muted">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Student ID</th>
                        <th className="px-4 py-3">Enrolment</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">UTR</th>
                        <th className="px-4 py-3">Submitted</th>
                      </tr>
                    </thead>

                    <tbody>
                      {participants.map(({ enrolment, payment }) => (
                        <tr
                          key={enrolment.id}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-4 py-4">
                            <p className="font-medium">
                              {payment?.student_name ?? 'Student'}
                            </p>
                            <p className="mt-1 text-xs text-slate-muted">
                              {payment?.student_id ?? enrolment.student_id ?? '—'}
                            </p>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs">
                            {enrolment.student_id ?? '—'}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                enrolment.status === 'active'
                                  ? 'bg-success/20 text-success'
                                  : enrolment.status === 'revoked'
                                    ? 'bg-danger/20 text-danger'
                                    : 'bg-gold/20 text-gold'
                              }`}
                            >
                              {enrolment.status}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {payment ? (
                              <span
                                className={`rounded-full px-2 py-1 text-xs ${
                                  payment.status === 'approved'
                                    ? 'bg-success/20 text-success'
                                    : payment.status === 'rejected'
                                      ? 'bg-danger/20 text-danger'
                                      : 'bg-gold/20 text-gold'
                                }`}
                              >
                                {payment.status}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {formatAmount(payment?.amount)}
                          </td>

                          <td className="px-4 py-4 font-mono text-xs">
                            {payment?.utr_reference ?? '—'}
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-muted">
                            {formatDate(payment?.submitted_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminRoute>
  )
}
