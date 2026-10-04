import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { firebaseAuth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Course } from '@/types/database'
import LearningMaterialsSection from '@/components/materials/LearningMaterialsSection'
import CompetitionMockTest from '@/components/competition/CompetitionMockTest'

type ViewState = 'access' | 'attempt' | 'result'

type CompetitionQuestion = {
  question_id: string
  course_id: string
  age_band?: string
  topic?: string
  subtopic?: string
  question: string
  question_type?: string
  options: string[]
  marks: number
  time_seconds: number
}

type CompetitionResult = {
  score: number
  maxScore: number
  answeredCount: number
}

const THIRUKKURAL_COURSE_ID = 'DNWt3cPE4ZSJG90CTC1e'
const THIRUKKURAL_SLUG = 'thirukkural'
const THIRUKKURAL_NAME = 'Thirukkural Mastery Championship'

const competitionCourse: Course = {
  id: THIRUKKURAL_COURSE_ID,
  category_id: 'vattams_competitions',
  name: THIRUKKURAL_NAME,
  slug: THIRUKKURAL_SLUG,
  subject: 'Thirukkural',
  short_description: 'Official Thirukkural competition',
  description: 'Official 30-question Thirukkural Mastery Championship.',
  level: null,
  duration_text: null,
  instructor_name: null,
  cover_image_url: null,
  preview_video_url: null,
  base_fee: 750,
  discount_amount: 0,
  is_free: false,
  is_published: true,
  is_featured: false,
  is_competition: true,
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

async function firebaseToken() {
  const current = firebaseAuth.currentUser
  if (!current) throw new Error('Your Firebase session has expired. Please sign in again.')
  return current.getIdToken()
}

async function invokeOfficial(name: string, body: Record<string, unknown>) {
  const token = await firebaseToken()
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) {
    let detail = error.message || 'Unknown Edge Function error'
    try {
      const context = (error as { context?: Response }).context
      if (context) {
        const text = await context.clone().text()
        if (text) detail += ` | HTTP ${context.status} | ${text}`
      }
    } catch {}
    throw new Error(detail)
  }
  return data
}

export default function CompetitionParticipant() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading } = useAuth()

  const [view, setView] = useState<ViewState>('access')
  const [questions, setQuestions] = useState<CompetitionQuestion[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState<CompetitionResult | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const autoSubmitRef = useRef(false)

  const course = slug === THIRUKKURAL_SLUG ? competitionCourse : null

  const totalSeconds = useMemo(
    () => questions.reduce((sum, q) => sum + Math.max(1, Number(q.time_seconds) || 60), 0),
    [questions],
  )

  const currentQuestion = questions[currentIndex]
  const answeredCount = questions.filter(
    (q) => (answers[q.question_id] ?? '').trim() !== '',
  ).length

  const loadQuestions = async (id: string, questionIds: string[]) => {
    const data = await invokeOfficial('competition-official-question-content', {
      attempt_id: id,
      question_ids: questionIds,
    })
    const loaded = Array.isArray(data?.questions) ? data.questions : []
    if (loaded.length !== 30) throw new Error('Unable to load all 30 competition questions.')
    setQuestions(loaded)
  }

  const startAttempt = async () => {
    if (!user || !course || busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      const data = await invokeOfficial('competition-official-attempt', {
        course_id: course.id,
      })
      const id = typeof data?.attempt_id === 'string' ? data.attempt_id : ''
      const ids = Array.isArray(data?.question_ids)
        ? data.question_ids.filter((x: unknown): x is string => typeof x === 'string')
        : []
      if (!id || ids.length !== 30 || new Set(ids).size !== 30) {
        throw new Error('Official competition returned an invalid 30-question attempt.')
      }

      await loadQuestions(id, ids)

      setAttemptId(id)
      const startMs = typeof data?.started_at === 'string' ? new Date(data.started_at).getTime() : Date.now()
      setStartedAtMs(startMs)
      setRemainingSeconds(totalSeconds)
      setAnswers({})
      setCurrentIndex(0)
      setView('attempt')
    } catch (error) {
      console.error('Failed to start official competition:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start the competition.')
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
      const data = await invokeOfficial('competition-official-scoring', {
        attempt_id: attemptId,
        answers: questions.map((q) => ({
          questionId: q.question_id,
          answer: answers[q.question_id] ?? '',
        })),
      })
      setResult({
        score: Number(data?.score) || 0,
        maxScore: Number(data?.maxScore) || 0,
        answeredCount: Number(data?.answeredCount) || answeredCount,
      })
      setView('result')
    } catch (error) {
      autoSubmitRef.current = false
      console.error('Failed to submit official competition:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit the competition.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (view !== 'attempt' || !startedAtMs || totalSeconds <= 0) return

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000)
      const remaining = Math.max(0, totalSeconds - elapsed)
      setRemainingSeconds(remaining)
      if (remaining === 0 && !autoSubmitRef.current) {
        void submitAttempt()
      }
    }

    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [view, startedAtMs, totalSeconds])

  const saveAnswer = (questionId: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }))
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div className="card h-64 animate-pulse" /></div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ redirectTo: `/competition/${slug}` }} replace />
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Competition not found</p>
        <Link to="/competitions" className="btn-secondary mt-6 inline-flex">Browse competitions</Link>
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
                <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">Official Competition</span>
                <h1 className="mt-3 font-display text-2xl font-semibold">{course.name}</h1>
              </div>
              <div className="rounded-card border border-gold/20 bg-white/5 px-4 py-2 text-center">
                <p className="text-[11px] text-slate-muted">Time</p>
                <p className="mt-1 font-semibold">{formatTime(remainingSeconds)}</p>
              </div>
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {errorMessage && <div className="mb-5 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{errorMessage}</div>}

          <div className="mb-5 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-muted">Question {currentIndex + 1} of {questions.length}</span>
            <span className="text-slate-muted">Answered {answeredCount}/{questions.length}</span>
          </div>

          <div className="card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gold">{currentQuestion.topic || 'Question'}</span>
              <span className="text-xs text-slate-muted">{currentQuestion.marks} mark{currentQuestion.marks === 1 ? '' : 's'}</span>
            </div>

            <h2 className="mt-5 whitespace-pre-line text-lg font-semibold leading-8 sm:text-xl">{currentQuestion.question}</h2>

            <div className="mt-7 space-y-3">
              {currentQuestion.options.map((option, index) => {
                const selected = answers[currentQuestion.question_id] === option
                return (
                  <button
                    key={`${currentQuestion.question_id}-${index}`}
                    type="button"
                    onClick={() => saveAnswer(currentQuestion.question_id, option)}
                    disabled={busy}
                    className={`flex w-full items-start gap-3 rounded-card border px-4 py-4 text-left text-sm transition ${selected ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 bg-black/10 hover:border-gold/30'} disabled:opacity-50`}
                  >
                    <span className="font-semibold">{String.fromCharCode(65 + index)}.</span>
                    <span>{option}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button type="button" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0 || busy} className="btn-secondary disabled:opacity-40">Previous</button>
              <div className="flex flex-wrap gap-3">
                {currentIndex < questions.length - 1 && (
                  <button type="button" onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={busy} className="btn-primary disabled:opacity-40">Next</button>
                )}
                <button type="button" onClick={() => void submitAttempt()} disabled={busy} className="rounded-card border border-gold/40 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold disabled:opacity-50">
                  {busy ? 'Submitting...' : 'Submit Competition'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {questions.map((q, index) => {
              const answered = (answers[q.question_id] ?? '').trim() !== ''
              return (
                <button key={q.question_id} type="button" onClick={() => setCurrentIndex(index)} className={`h-9 min-w-9 rounded-full border px-2 text-xs ${index === currentIndex ? 'border-gold bg-gold/20 text-gold' : answered ? 'border-success/40 bg-success/10 text-success' : 'border-white/10 text-slate-muted'}`}>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Competition completed</p>
          <h1 className="mt-4 font-display text-3xl font-semibold">{course.name}</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-muted">Score</p><p className="mt-2 text-2xl font-bold">{result.score}</p></div>
            <div className="rounded-card border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-muted">Maximum</p><p className="mt-2 text-2xl font-bold">{result.maxScore}</p></div>
            <div className="rounded-card border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-muted">Answered</p><p className="mt-2 text-2xl font-bold">{result.answeredCount}</p></div>
          </div>
          <Link to="/competitions" className="btn-secondary mt-8 inline-flex">View competitions</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b border-gold/15">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">Official Competition</span>
          <h1 className="mt-4 font-display text-3xl font-semibold">{course.name}</h1>
          <p className="mt-4 text-parchment/90">Your competition registration will be verified when you start.</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card p-6">
          {errorMessage && <div className="mb-5 rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{errorMessage}</div>}

          <div className="rounded-card border border-gold/15 bg-white/5 p-5">
            <h2 className="font-display text-lg">Official Competition</h2>
            <p className="mt-2 text-sm text-slate-muted">
              30 questions are selected randomly according to your age band. During the competition, only the questions and options are shown. Correct answers and explanations are not revealed.
            </p>
            <button type="button" onClick={() => void startAttempt()} disabled={busy} className="btn-primary mt-5 disabled:opacity-50">
              {busy ? 'Starting...' : 'Start Competition'}
            </button>
          </div>

          <section className="mt-8">
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Preparation</span>
              <h2 className="mt-2 font-display text-2xl font-semibold">Study Materials</h2>
              <p className="mt-2 text-sm text-slate-muted">Prepare for this competition using the published study resources.</p>
            </div>
            <LearningMaterialsSection courseId={course.id} />
          </section>

          <CompetitionMockTest course={course} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
            <Link to="/competitions" className="btn-secondary">View competitions</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
