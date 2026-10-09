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

type OfficialAttemptRow = {
  id: string
  student_id: string
  status: string
  question_ids: string[]
  started_at?: string | null
  submitted_at?: string | null
  score?: number | null
  max_score?: number | null
  answered_count?: number | null
}

type MockAttemptRow = {
  id: string
  student_id: string
  course_id: string
  status: string
  question_ids: string[]
  started_at?: string | null
  submitted_at?: string | null
  scored_at?: string | null
  score?: number | null
  max_score?: number | null
  answered_count?: number | null
  is_mock?: boolean
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
  const [officialAttempts, setOfficialAttempts] = useState<OfficialAttemptRow[]>([])
  const [officialResults, setOfficialResults] = useState<Record<string, Record<string, unknown>>>({})
  const [mockAttempts, setMockAttempts] = useState<MockAttemptRow[]>([])
  const [mockResults, setMockResults] = useState<Record<string, Record<string, unknown>>>({})
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

      // Load each admin panel independently: one legacy/optional collection
      // failing to read must not blank the entire competition management page.
      const reads = await Promise.allSettled([
        getDocs(query(collection(firestore, 'enrolments'), where('course_id', '==', id))),
        getDocs(query(collection(firestore, 'payments'), where('course_id', '==', id))),
        getDocs(query(collection(firestore, 'competition_attempts'), where('course_id', '==', id))),
        getDocs(query(collection(firestore, 'competition_mock_attempts'), where('course_id', '==', id))),
      ])

      const [enrolmentRead, paymentRead, attemptRead, mockAttemptRead] = reads
      const enrolmentSnapshot = enrolmentRead.status === 'fulfilled'
        ? enrolmentRead.value
        : null
      const paymentSnapshot = paymentRead.status === 'fulfilled'
        ? paymentRead.value
        : null
      const attemptSnapshot = attemptRead.status === 'fulfilled'
        ? attemptRead.value
        : null
      const mockAttemptSnapshot = mockAttemptRead.status === 'fulfilled'
        ? mockAttemptRead.value
        : null

      for (const [name, result] of [
        ['enrolments', enrolmentRead],
        ['payments', paymentRead],
        ['official attempts', attemptRead],
        ['mock attempts', mockAttemptRead],
      ] as const) {
        if (result.status === 'rejected') {
          console.error(`[AdminCompetitionDetail] Failed to load ${name}; keeping the rest of the page available.`, result.reason)
        }
      }

      const attempts = (attemptSnapshot?.docs ?? []).map(
        (item) =>
          ({
            id: item.id,
            ...item.data(),
          }) as OfficialAttemptRow,
      )

      const mockAttemptsLoaded = (mockAttemptSnapshot?.docs ?? []).map(
        (item) =>
          ({
            id: item.id,
            ...item.data(),
          }) as MockAttemptRow,
      )

      const mockResultSnapshots = await Promise.all(
        mockAttemptsLoaded
          .filter((attempt) => attempt.status === 'submitted')
          .map(async (attempt) => {
            const result = await getDoc(
              doc(
                firestore,
                'competition_mock_results',
                `${attempt.student_id}_${attempt.id}`,
              ),
            )

            return [
              attempt.id,
              result.exists() ? result.data() : null,
            ] as const
          }),
      )

      const loadedMockResults: Record<string, Record<string, unknown>> = {}

      for (const [attemptId, result] of mockResultSnapshots) {
        if (result) {
          loadedMockResults[attemptId] = result
        }
      }

      const resultSnapshots = await Promise.all(
        attempts
          .filter((attempt) => attempt.status === 'submitted')
          .map(async (attempt) => {
            const result = await getDoc(
              doc(
                firestore,
                'competition_results',
                `${attempt.student_id}_${attempt.id}`,
              ),
            )

            return [
              attempt.id,
              result.exists() ? result.data() : null,
            ] as const
          }),
      )

      const results: Record<string, Record<string, unknown>> = {}

      for (const [attemptId, result] of resultSnapshots) {
        if (result) {
          results[attemptId] = result
        }
      }

      setOfficialAttempts(attempts)
      setOfficialResults(results)
      setMockAttempts(mockAttemptsLoaded)
      setMockResults(loadedMockResults)

      setCompetition(course)

      setEnrolments(
        (enrolmentSnapshot?.docs ?? []).map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as Enrolment,
        ),
      )

      setPayments(
        (paymentSnapshot?.docs ?? []).map(
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

  const officialAttemptStats = useMemo(
    () => ({
      total: officialAttempts.length,
      inProgress: officialAttempts.filter((item) => item.status === 'in_progress').length,
      submitted: officialAttempts.filter((item) => item.status === 'submitted').length,
      scored: officialAttempts.filter((item) => Boolean(officialResults[item.id])).length,
    }),
    [officialAttempts, officialResults],
  )

  const mockAttemptStats = useMemo(
    () => ({
      total: mockAttempts.length,
      inProgress: mockAttempts.filter((item) => item.status === 'in_progress').length,
      submitted: mockAttempts.filter((item) => item.status === 'submitted').length,
      scored: mockAttempts.filter((item) => Boolean(mockResults[item.id])).length,
    }),
    [mockAttempts, mockResults],
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
              <h2 className="font-display text-2xl">Competition Management</h2>
              <p className="mt-1 text-sm text-slate-muted">
                Manage the competition using the existing Admin course and material tools.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  to={`/admin/courses/${competition.id}`}
                  className="card p-5 transition hover:border-gold/40"
                >
                  <p className="font-display text-lg">Edit Competition</p>
                  <p className="mt-1 text-sm text-slate-muted">
                    Edit competition details, pricing, publishing, featured status,
                    and age eligibility.
                  </p>
                  <span className="mt-4 inline-block text-sm text-gold">
                    Open settings →
                  </span>
                </Link>

                <Link
                  to={`/admin/courses/${competition.id}/materials`}
                  className="card p-5 transition hover:border-gold/40"
                >
                  <p className="font-display text-lg">Study Materials</p>
                  <p className="mt-1 text-sm text-slate-muted">
                    Upload, edit, publish, unpublish, and manage competition
                    preparation materials.
                  </p>
                  <span className="mt-4 inline-block text-sm text-gold">
                    Manage materials →
                  </span>
                </Link>

                <Link
                  to={`/admin/courses/${competition.id}/content`}
                  className="card p-5 transition hover:border-gold/40"
                >
                  <p className="font-display text-lg">Course Content</p>
                  <p className="mt-1 text-sm text-slate-muted">
                    Open the existing content management area for this competition.
                  </p>
                  <span className="mt-4 inline-block text-sm text-gold">
                    Open content →
                  </span>
                </Link>
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
              <h2 className="font-display text-2xl">Official Attempts & Results</h2>
              <p className="mt-1 text-sm text-slate-muted">
                Official competition attempts only. Mock Test activity is kept separate.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Total Attempts</p>
                  <p className="mt-2 font-display text-2xl">
                    {officialAttemptStats.total}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">In Progress</p>
                  <p className="mt-2 font-display text-2xl text-gold">
                    {officialAttemptStats.inProgress}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Submitted</p>
                  <p className="mt-2 font-display text-2xl">
                    {officialAttemptStats.submitted}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Scored</p>
                  <p className="mt-2 font-display text-2xl text-success">
                    {officialAttemptStats.scored}
                  </p>
                </div>
              </div>

              {officialAttempts.length === 0 ? (
                <div className="card mt-4 p-8 text-center text-sm text-slate-muted">
                  No official competition attempts yet.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto card">
                  <table className="min-w-[1100px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-muted">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Attempt ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Started</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Answered</th>
                      </tr>
                    </thead>

                    <tbody>
                      {officialAttempts
                        .slice()
                        .sort((a, b) => {
                          const aTime = a.started_at
                            ? new Date(a.started_at).getTime()
                            : 0
                          const bTime = b.started_at
                            ? new Date(b.started_at).getTime()
                            : 0
                          return bTime - aTime
                        })
                        .map((attempt) => {
                          const result = officialResults[attempt.id]
                          const score =
                            typeof result?.score === 'number'
                              ? result.score
                              : attempt.score
                          const maxScore =
                            typeof result?.max_score === 'number'
                              ? result.max_score
                              : attempt.max_score
                          const answeredCount =
                            typeof result?.answered_count === 'number'
                              ? result.answered_count
                              : attempt.answered_count

                          return (
                            <tr
                              key={attempt.id}
                              className="border-b border-white/5 last:border-0"
                            >
                              <td className="px-4 py-4">
                                <p className="font-medium">
                                  {paymentsByStudent.get(attempt.student_id)?.student_name ??
                                    'Student'}
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-muted">
                                  {attempt.student_id}
                                </p>
                              </td>

                              <td className="px-4 py-4 font-mono text-xs">
                                {attempt.id}
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs ${
                                    attempt.status === 'submitted'
                                      ? 'bg-success/20 text-success'
                                      : 'bg-gold/20 text-gold'
                                  }`}
                                >
                                  {attempt.status}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-xs text-slate-muted">
                                {formatDate(attempt.started_at)}
                              </td>

                              <td className="px-4 py-4 text-xs text-slate-muted">
                                {formatDate(attempt.submitted_at)}
                              </td>

                              <td className="px-4 py-4 font-medium">
                                {score != null && maxScore != null
                                  ? `${score} / ${maxScore}`
                                  : '—'}
                              </td>

                              <td className="px-4 py-4">
                                {answeredCount != null ? answeredCount : '—'}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-8">
              <h2 className="font-display text-2xl">Mock Test Management</h2>
              <p className="mt-1 text-sm text-slate-muted">
                Practice attempts only. These records are completely separate from
                official competition attempts and results.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Total Mock Attempts</p>
                  <p className="mt-2 font-display text-2xl">
                    {mockAttemptStats.total}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">In Progress</p>
                  <p className="mt-2 font-display text-2xl text-gold">
                    {mockAttemptStats.inProgress}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Submitted</p>
                  <p className="mt-2 font-display text-2xl">
                    {mockAttemptStats.submitted}
                  </p>
                </div>

                <div className="card p-5">
                  <p className="text-xs text-slate-muted">Scored</p>
                  <p className="mt-2 font-display text-2xl text-success">
                    {mockAttemptStats.scored}
                  </p>
                </div>
              </div>

              {mockAttempts.length === 0 ? (
                <div className="card mt-4 p-8 text-center text-sm text-slate-muted">
                  No mock test attempts yet.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto card">
                  <table className="min-w-[1100px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-muted">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Attempt ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Started</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="px-4 py-3">Answered</th>
                      </tr>
                    </thead>

                    <tbody>
                      {mockAttempts
                        .slice()
                        .sort((a, b) => {
                          const aTime = a.started_at
                            ? new Date(a.started_at).getTime()
                            : 0
                          const bTime = b.started_at
                            ? new Date(b.started_at).getTime()
                            : 0
                          return bTime - aTime
                        })
                        .map((attempt) => {
                          const result = mockResults[attempt.id]

                          const score =
                            typeof result?.score === 'number'
                              ? result.score
                              : attempt.score

                          const maxScore =
                            typeof result?.max_score === 'number'
                              ? result.max_score
                              : attempt.max_score

                          const answeredCount =
                            typeof result?.answered_count === 'number'
                              ? result.answered_count
                              : attempt.answered_count

                          return (
                            <tr
                              key={attempt.id}
                              className="border-b border-white/5 last:border-0"
                            >
                              <td className="px-4 py-4">
                                <p className="font-medium">
                                  {paymentsByStudent.get(attempt.student_id)?.student_name ??
                                    'Student'}
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-muted">
                                  {attempt.student_id}
                                </p>
                              </td>

                              <td className="px-4 py-4 font-mono text-xs">
                                {attempt.id}
                              </td>

                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs ${
                                    attempt.status === 'submitted'
                                      ? 'bg-success/20 text-success'
                                      : 'bg-gold/20 text-gold'
                                  }`}
                                >
                                  {attempt.status}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-xs text-slate-muted">
                                {formatDate(attempt.started_at)}
                              </td>

                              <td className="px-4 py-4 text-xs text-slate-muted">
                                {formatDate(attempt.submitted_at)}
                              </td>

                              <td className="px-4 py-4 font-medium">
                                {score != null && maxScore != null
                                  ? `${score} / ${maxScore}`
                                  : '—'}
                              </td>

                              <td className="px-4 py-4">
                                {answeredCount != null ? answeredCount : '—'}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
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
