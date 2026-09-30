import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { firebaseAuth, firestore } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import LearningMaterialsSection from '@/components/materials/LearningMaterialsSection'
import CompetitionMockTest from '@/components/competition/CompetitionMockTest'

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error'
type ViewState = 'access' | 'attempt' | 'result'

type CompetitionQuestion = {
  id: string
  question_id: string
  course_id: string
  question: string
  question_type?: string
  topic?: string
  subtopic?: string
  marks: number
  time_seconds: number
  is_published?: boolean
}

type CompetitionAttempt = {
  id: string
  student_id: string
  course_id: string
  status: 'in_progress' | 'submitted' | string
  started_at?: { toMillis?: () => number }
  question_ids?: string[]
}

type CompetitionResult = {
  score: number
  maxScore: number
  answeredCount: number
}

const OFFICIAL_COMPETITION_QUESTION_IDS = [
  ...Array.from({ length: 8 }, (_, i) => `TKR-REC-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `TKR-ADH-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `TKR-MEAN-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 7 }, (_, i) => `TKR-KNOW-${String(i + 1).padStart(2, '0')}`),
] as const

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const secs = safe % 60

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}


export default function CompetitionParticipant() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [hasActiveEnrolment, setHasActiveEnrolment] = useState(false)

  const [questions, setQuestions] = useState<CompetitionQuestion[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const [view, setView] = useState<ViewState>('access')
  const [result, setResult] = useState<CompetitionResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const autoSubmitRef = useRef(false)

  const totalSeconds = useMemo(
    () =>
      questions.reduce(
        (sum, question) =>
          sum + Math.max(1, Number(question.time_seconds) || 60),
        0,
      ),
    [questions],
  )

  const currentQuestion = questions[currentIndex]

  const answeredCount = questions.filter(
    (question) => (answers[question.question_id] ?? '').trim() !== '',
  ).length


  const startAttempt = async () => {
    if (!user || !course || questions.length === 0 || busy) return

    setBusy(true)
    setErrorMessage('')

    try {
      const attemptRef = doc(collection(firestore, 'competition_attempts'))

      const indexRef = doc(
        firestore,
        'competition_question_indexes',
        course.id,
      )

      const indexSnapshot = await getDoc(indexRef)

      if (!indexSnapshot.exists()) {
        throw new Error(
          'Competition question bank is not configured yet.',
        )
      }

      const indexData = indexSnapshot.data()
      const modules = indexData.modules as Record<string, unknown> | undefined
      const perAttempt = Number(indexData.per_attempt) || 30

      if (!modules || perAttempt !== 30) {
        throw new Error(
          'Competition question bank configuration is invalid.',
        )
      }

      if (OFFICIAL_COMPETITION_QUESTION_IDS.length !== perAttempt) {
        throw new Error(
          'Official competition question configuration is invalid.',
        )
      }

      const selectedQuestionIds = [...OFFICIAL_COMPETITION_QUESTION_IDS]

      await setDoc(attemptRef, {
        student_id: user.uid,
        course_id: course.id,
        status: 'in_progress',
        started_at: serverTimestamp(),
        question_ids: selectedQuestionIds,
      })

      const attemptSnapshot = await getDoc(attemptRef)
      const attemptData = attemptSnapshot.data()
      const savedStart =
        attemptData?.started_at?.toMillis?.() ?? Date.now()

      setAttemptId(attemptRef.id)
      setStartedAtMs(savedStart)
      setAnswers({})
      setCurrentIndex(0)
      setRemainingSeconds(totalSeconds)
      setView('attempt')
    } catch (error) {
      console.error('Failed to start competition attempt:', error)
      setErrorMessage('Unable to start the competition. Please try again.')
    } finally {
      setBusy(false)
    }
  }


  const submitAttempt = async () => {
    if (!attemptId || !user || busy || autoSubmitRef.current) return

    autoSubmitRef.current = true
    setBusy(true)
    setErrorMessage('')

    try {
      const firebaseUser = firebaseAuth.currentUser
    if (!firebaseUser) {
      throw new Error('Your Firebase session has expired. Please sign in again.')
    }

    const token = await firebaseUser.getIdToken()

      const { data, error } = await supabase.functions.invoke(
        'competition-scoring',
        {
          body: {
            attemptId,
            answers: questions.map((question) => ({
              questionId: question.question_id,
              answer: answers[question.question_id] ?? '',
            })),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (error) {
        throw error
      }

      const scoreData = data as {
        score?: number
        maxScore?: number
        answeredCount?: number
      }

      setResult({
        score: Number(scoreData.score) || 0,
        maxScore: Number(scoreData.maxScore) || 0,
        answeredCount: Number(scoreData.answeredCount) || answeredCount,
      })

      setView('result')
    } catch (error) {
      console.error('Failed to submit competition attempt:', error)
      autoSubmitRef.current = false
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit the competition. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (
      view !== 'attempt' ||
      !attemptId ||
      !startedAtMs ||
      totalSeconds <= 0
    ) {
      return
    }

    const updateTimer = () => {
      const elapsedSeconds = Math.floor(
        (Date.now() - startedAtMs) / 1000,
      )
      const remaining = Math.max(0, totalSeconds - elapsedSeconds)

      setRemainingSeconds(remaining)

      if (remaining === 0 && !autoSubmitRef.current) {
        void submitAttempt()
      }
    }

    updateTimer()

    const timer = window.setInterval(updateTimer, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [view, attemptId, startedAtMs, totalSeconds])

  const saveAnswer = async (questionId: string, value: string) => {
    if (!attemptId || !user) return

    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }))

    try {
      await setDoc(
        doc(
          firestore,
          'competition_attempts',
          attemptId,
          'answers',
          questionId,
        ),
        {
          question_id: questionId,
          answer: value,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error('Failed to save competition answer:', error)
      setErrorMessage('Answer could not be saved. Please try again.')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !slug) return

      setState('loading')
      setErrorMessage('')

      try {
        const courseQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true),
        )

        const courseSnapshot = await getDocs(courseQuery)

        if (cancelled) return

        if (courseSnapshot.empty) {
          setState('not-found')
          return
        }

        const courseDoc = courseSnapshot.docs[0]
        const loadedCourse = {
          id: courseDoc.id,
          ...courseDoc.data(),
        } as Course

        if (!loadedCourse.is_competition) {
          setState('not-found')
          return
        }

        const enrolmentRef = doc(
          firestore,
          'enrolments',
          `${user.uid}_${loadedCourse.id}`,
        )

        const enrolmentSnapshot = await getDoc(enrolmentRef)

        if (cancelled) return

        const enrolled =
          enrolmentSnapshot.exists() &&
          enrolmentSnapshot.data().status === 'active'

        setCourse(loadedCourse)
        setHasActiveEnrolment(enrolled)

        if (!enrolled) {
          setState('loaded')
          return
        }

        const indexRef = doc(
          firestore,
          'competition_question_indexes',
          loadedCourse.id,
        )

        const indexSnapshot = await getDoc(indexRef)

        if (cancelled) return

        if (!indexSnapshot.exists()) {
          throw new Error(
            'Competition question bank is not configured yet.',
          )
        }

        const indexData = indexSnapshot.data()
        const totalQuestions = Number(indexData.total_questions) || 0
        const perAttempt = Number(indexData.per_attempt) || 30
        const modules = indexData.modules as Record<string, unknown> | undefined

        if (
          totalQuestions < perAttempt ||
          perAttempt !== 30 ||
          !modules ||
          typeof modules !== 'object'
        ) {
          throw new Error(
            'Competition question bank configuration is invalid.',
          )
        }

        const allQuestionIds = Object.values(modules)
          .filter(Array.isArray)
          .flat()
          .filter((id): id is string => typeof id === 'string')

        if (
          allQuestionIds.length !== totalQuestions ||
          new Set(allQuestionIds).size !== totalQuestions
        ) {
          throw new Error(
            'Competition question bank index failed validation.',
          )
        }

        const attemptSnapshot = await getDocs(
          query(
            collection(firestore, 'competition_attempts'),
            where('student_id', '==', user.uid),
          ),
        )

        if (cancelled) return

        const matchingAttempts: CompetitionAttempt[] = attemptSnapshot.docs
          .map((attemptDoc): CompetitionAttempt => ({
            id: attemptDoc.id,
            ...(attemptDoc.data() as Omit<CompetitionAttempt, 'id'>),
          }))
          .filter(
            (attempt) =>
              attempt.course_id === loadedCourse.id,
          )

        const activeAttempt = matchingAttempts.find(
          (attempt) => attempt.status === 'in_progress',
        )

        let selectedQuestionIds: string[] = []

        if (activeAttempt) {
          selectedQuestionIds = Array.isArray(
            activeAttempt.question_ids,
          )
            ? activeAttempt.question_ids.filter(
                (id): id is string => typeof id === 'string',
              )
            : []

          if (
            selectedQuestionIds.length !== perAttempt ||
            new Set(selectedQuestionIds).size !== perAttempt
          ) {
            throw new Error(
              'This competition attempt has an invalid question set.',
            )
          }
        } else {
          if (OFFICIAL_COMPETITION_QUESTION_IDS.length !== perAttempt) {
            throw new Error(
              'Official competition question configuration is invalid.',
            )
          }

          selectedQuestionIds = [...OFFICIAL_COMPETITION_QUESTION_IDS]
        }

        const questionSnapshots = await Promise.all(
          selectedQuestionIds.map((questionId) =>
            getDoc(doc(firestore, 'competition_questions', questionId)),
          ),
        )

        if (cancelled) return

        const questionMap = new Map(
          questionSnapshots
            .filter((questionSnapshot) => questionSnapshot.exists())
            .map((questionSnapshot) => [
              questionSnapshot.id,
              {
                id: questionSnapshot.id,
                ...questionSnapshot.data(),
              } as CompetitionQuestion,
            ]),
        )

        const loadedQuestions = selectedQuestionIds
          .map((questionId) => questionMap.get(questionId))
          .filter(
            (question): question is CompetitionQuestion =>
              question !== undefined &&
              question.is_published !== false,
          )

        if (loadedQuestions.length !== perAttempt) {
          throw new Error(
            `Unable to load all ${perAttempt} questions for this attempt.`,
          )
        }

        setQuestions(loadedQuestions)

        if (activeAttempt) {
          const savedStart =
            activeAttempt.started_at?.toMillis?.() ??
            Date.now()

          setAttemptId(activeAttempt.id)
          setStartedAtMs(savedStart)

          const answerSnapshot = await getDocs(
            collection(
              firestore,
              'competition_attempts',
              activeAttempt.id,
              'answers',
            ),
          )

          if (cancelled) return

          const restoredAnswers: Record<string, string> = {}

          answerSnapshot.docs.forEach((answerDoc) => {
            const data = answerDoc.data()

            if (typeof data.answer === 'string') {
              restoredAnswers[answerDoc.id] = data.answer
            }
          })

          setAnswers(restoredAnswers)
          setCurrentIndex(0)

          const elapsedSeconds = Math.floor(
            (Date.now() - savedStart) / 1000,
          )

          setRemainingSeconds(
            Math.max(0, totalSeconds - elapsedSeconds),
          )

          setView('attempt')
        } else {
          const submittedAttempt = matchingAttempts.find(
            (attempt) => attempt.status === 'submitted',
          )

          if (submittedAttempt) {
            const resultRef = doc(
              firestore,
              'competition_results',
              `${user.uid}_${submittedAttempt.id}`,
            )

            const resultSnapshot = await getDoc(resultRef)

            if (resultSnapshot.exists()) {
              const data = resultSnapshot.data()

              setAttemptId(submittedAttempt.id)

              setResult({
                score: Number(data.score) || 0,
                maxScore: Number(data.max_score) || 0,
                answeredCount:
                  Number(data.answered_count) || 0,
              })

              setView('result')
            }
          }
        }

        setState('loaded')
      } catch (err) {
        if (cancelled) return

        console.error(
          'Failed to load competition participant page:',
          err,
        )

        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load competition.',
        )

        setState('error')
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user, slug, totalSeconds])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ redirectTo: `/competition/${slug}` }} replace />
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (state === 'not-found' || !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Competition not found</p>
        <Link to="/competitions" className="btn-secondary mt-6 inline-flex">
          Browse competitions
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg text-danger">
          Couldn&apos;t load this competition
        </p>
        <p className="mt-2 text-sm text-slate-muted">
          {errorMessage || 'Please refresh the page and try again.'}
        </p>
      </div>
    )
  }

  const displayName = getCourseDisplayName(course.name)

  if (!hasActiveEnrolment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Registration required</p>
        <p className="mt-2 text-sm text-slate-muted">
          You do not have an active registration for this competition.
        </p>
        <Link
          to={`/courses/${course.slug}`}
          className="btn-primary mt-6 inline-flex"
        >
          View competition
        </Link>
      </div>
    )
  }
  if (view === 'attempt' && currentQuestion) {
    return (
      <div>
        <section className="border-b border-gold/15">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
                  Competition
                </span>
                <h1 className="mt-3 font-display text-2xl font-semibold">
                  {displayName}
                </h1>
              </div>

              <div className="rounded-card border border-gold/20 bg-white/5 px-4 py-2 text-center">
                <p className="text-[11px] text-slate-muted">Time</p>
                <p className="mt-1 font-semibold">{formatTime(remainingSeconds)}</p>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {errorMessage && (
            <div className="mb-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <div className="mb-5 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-muted">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-slate-muted">
              Answered {answeredCount}/{questions.length}
            </span>
          </div>

          <div className="card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                {currentQuestion.topic || 'Question'}
              </span>
              <span className="text-xs text-slate-muted">
                {currentQuestion.marks} mark
                {currentQuestion.marks === 1 ? '' : 's'}
              </span>
            </div>

            <h2 className="mt-5 text-lg font-semibold leading-8 sm:text-xl">
              {currentQuestion.question}
            </h2>

            <label
              htmlFor={`answer-${currentQuestion.question_id}`}
              className="mt-7 block text-sm font-medium"
            >
              Your answer
            </label>

            <textarea
              id={`answer-${currentQuestion.question_id}`}
              value={answers[currentQuestion.question_id] ?? ''}
              onChange={(event) =>
                void saveAnswer(
                  currentQuestion.question_id,
                  event.target.value,
                )
              }
              placeholder="Type your answer here..."
              rows={4}
              className="mt-2 w-full rounded-card border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-gold/50"
            />

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((index) => Math.max(0, index - 1))
                }
                disabled={currentIndex === 0 || busy}
                className="btn-secondary disabled:opacity-40"
              >
                Previous
              </button>

              <div className="flex flex-wrap gap-3">
                {currentIndex < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((index) =>
                        Math.min(questions.length - 1, index + 1),
                      )
                    }
                    disabled={busy}
                    className="btn-primary disabled:opacity-40"
                  >
                    Next
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void submitAttempt()}
                  disabled={busy}
                  className="rounded-card border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Submitting...' : 'Submit Competition'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const answered =
                (answers[question.question_id] ?? '').trim() !== ''

              return (
                <button
                  key={question.question_id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-9 min-w-9 rounded-full border px-2 text-xs ${
                    index === currentIndex
                      ? 'border-gold bg-gold/20 text-gold'
                      : answered
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-white/10 text-slate-muted'
                  }`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  if (view === 'result' && result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Competition completed
          </p>

          <h1 className="mt-4 font-display text-3xl font-semibold">
            {displayName}
          </h1>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Score</p>
              <p className="mt-2 text-2xl font-bold">{result.score}</p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Maximum</p>
              <p className="mt-2 text-2xl font-bold">{result.maxScore}</p>
            </div>

            <div className="rounded-card border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-muted">Answered</p>
              <p className="mt-2 text-2xl font-bold">
                {result.answeredCount}
              </p>
            </div>
          </div>

          <Link to="/competitions" className="btn-secondary mt-8 inline-flex">
            View competitions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b border-gold/15">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
            Competition
          </span>

          <h1 className="mt-4 font-display text-3xl font-semibold">
            {displayName}
          </h1>

          <p className="mt-4 text-parchment/90">
            Your registration is active.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-muted">Registration status</p>
              <p className="mt-1 font-semibold text-success">ACTIVE</p>
            </div>

            <span className="rounded-full bg-success/20 px-3 py-1 text-xs text-success">
              Registered
            </span>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 rounded-card border border-gold/15 bg-white/5 p-5">
            <h2 className="font-display text-lg">Competition access</h2>

            <p className="mt-2 text-sm text-slate-muted">
              {questions.length > 0
                ? `${questions.length} questions are ready for your attempt.`
                : 'Competition questions are not currently available.'}
            </p>

            {questions.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card border border-white/10 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {attemptId ? 'Resume your attempt' : 'Ready to start'}
                  </p>
                  <p className="mt-1 text-xs text-slate-muted">
                    {attemptId
                      ? `${answeredCount} of ${questions.length} answered`
                      : `${questions.length} questions available`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void startAttempt()}
                  disabled={busy}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy
                    ? 'Starting...'
                    : attemptId
                      ? 'Resume Competition'
                      : 'Start Competition'}
                </button>
              </div>
            )}
          </div>

          <section className="mt-8">
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Preparation
              </span>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Study Materials
              </h2>
              <p className="mt-2 text-sm text-slate-muted">
                Prepare for this competition using the published study resources.
              </p>
            </div>

            <LearningMaterialsSection courseId={course.id} />
          </section>

          <CompetitionMockTest course={course} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn-secondary">
              Back to dashboard
            </Link>

            <Link to="/competitions" className="btn-secondary">
              View competitions
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
