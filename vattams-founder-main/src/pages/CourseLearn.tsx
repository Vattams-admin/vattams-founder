import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'

interface Course {
  id: string
  name: string
  slug: string
  is_published?: boolean
}

interface Lesson {
  id: string
  title: string
  video_url: string | null
  pdf_url: string | null
  content: string | null
  sort_order: number
  module_id: string
}

interface Module {
  id: string
  title: string
  sort_order: number
}

interface ProgressRow {
  lesson_id: string
  completed: boolean
}

export default function CourseLearn() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState('')
  const [enrolmentId, setEnrolmentId] = useState<string | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progress, setProgress] = useState<Record<string, boolean>>({})
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<
    'loading' | 'no_access' | 'error' | 'ready'
  >('loading')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate('/login', {
        state: { redirectTo: `/learn/${slug}` },
      })
      return
    }

    let cancelled = false
    const userId = user.uid

    async function load() {
      try {
        setError(null)
        setStatus('loading')

        // ---------------------------------------------------------
        // 1. Find published course by slug
        // ---------------------------------------------------------
        const courseQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true)
        )

        const courseSnapshot = await getDocs(courseQuery)

        if (cancelled) return

        if (courseSnapshot.empty) {
          setError('Course not found.')
          setStatus('no_access')
          return
        }

        const courseDoc = courseSnapshot.docs[0]
        const course = {
          id: courseDoc.id,
          ...(courseDoc.data() as Omit<Course, 'id'>),
        } as Course

        setCourseId(course.id)
        setCourseName(course.name)

        // ---------------------------------------------------------
        // 2. Check active enrolment
        // ---------------------------------------------------------
        const enrolmentQuery = query(
          collection(firestore, 'enrolments'),
          where('student_id', '==', userId),
          where('course_id', '==', course.id),
          where('status', '==', 'active')
        )

        const enrolmentSnapshot = await getDocs(enrolmentQuery)

        if (cancelled) return

        if (enrolmentSnapshot.empty) {
          setStatus('no_access')
          return
        }

        const enrolmentDoc = enrolmentSnapshot.docs[0]

        const currentEnrolmentId = enrolmentDoc.id

        setEnrolmentId(currentEnrolmentId)

        // ---------------------------------------------------------
        // 3. Load course modules
        // ---------------------------------------------------------
        const moduleQuery = query(
          collection(firestore, 'course_modules'),
          where('course_id', '==', course.id),
          orderBy('sort_order', 'asc')
        )

        const moduleSnapshot = await getDocs(moduleQuery)

        const moduleRows: Module[] = moduleSnapshot.docs.map((doc) => {
          const data = doc.data()

          return {
            id: doc.id,
            title: data.title ?? '',
            sort_order: data.sort_order ?? 0,
          }
        })

        if (cancelled) return

        // ---------------------------------------------------------
        // 4. Load lessons for each module
        // ---------------------------------------------------------
        const lessonRows: Lesson[] = []

        for (const module of moduleRows) {
          const lessonQuery = query(
            collection(firestore, 'course_lessons'),
            where('module_id', '==', module.id),
            orderBy('sort_order', 'asc')
          )

          const lessonSnapshot = await getDocs(lessonQuery)

          lessonSnapshot.docs.forEach((lessonDoc) => {
            const data = lessonDoc.data()

            lessonRows.push({
              id: lessonDoc.id,
              title: data.title ?? '',
              video_url: data.video_url ?? null,
              pdf_url: data.pdf_url ?? null,
              content: data.content ?? null,
              sort_order: data.sort_order ?? 0,
              module_id: data.module_id ?? module.id,
            })
          })
        }

        if (cancelled) return

        // ---------------------------------------------------------
        // 5. Load lesson progress
        // ---------------------------------------------------------
        const progressQuery = query(
          collection(firestore, 'course_progress'),
          where('enrolment_id', '==', currentEnrolmentId),
          where('student_id', '==', userId)
        )

        const progressSnapshot = await getDocs(progressQuery)

        const progressRows: ProgressRow[] = progressSnapshot.docs.map(
          (progressDoc) => {
            const data = progressDoc.data()

            return {
              lesson_id: data.lesson_id,
              completed: data.completed === true,
            }
          }
        )

        if (cancelled) return

        // ---------------------------------------------------------
        // 6. Update state
        // ---------------------------------------------------------
        setModules(moduleRows)
        setLessons(lessonRows)

        setProgress(
          Object.fromEntries(
            progressRows.map((p) => [p.lesson_id, p.completed])
          )
        )

        // Resume at first incomplete lesson,
        // otherwise start with first lesson.
        const firstIncomplete = lessonRows.find(
          (lesson) =>
            !progressRows.some(
              (progressRow) =>
                progressRow.lesson_id === lesson.id &&
                progressRow.completed
            )
        )

        setActiveLessonId(
          firstIncomplete?.id ??
            lessonRows[0]?.id ??
            null
        )

        setStatus('ready')
      } catch (err) {
        console.error('CourseLearn Firebase error:', err)

        if (cancelled) return

        // A failure here (offline, Firestore unavailable, etc.) is not the
        // same thing as "not enrolled" — don't tell the student they lack
        // access when the real problem is the network. Route it to a
        // distinct error state with a retry action and a friendly message,
        // never the raw error text.
        setError('Unable to connect right now. Please check your internet connection and try again.')
        setStatus('error')
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug, user, authLoading, navigate, retryToken])

  const activeLesson = useMemo(
    () =>
      lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [lessons, activeLessonId]
  )

  const percentComplete = lessons.length
    ? Math.round(
        (100 *
          lessons.filter((lesson) => progress[lesson.id]).length) /
          lessons.length
      )
    : 0

  async function markComplete(lessonId: string) {
    if (!enrolmentId || !user) return

    try {
      // Use a deterministic document ID so the same lesson
      // cannot create duplicate progress records.
      const progressId = `${enrolmentId}_${lessonId}`

      await setDoc(
        doc(firestore, 'course_progress', progressId),
        {
          enrolment_id: enrolmentId,
          lesson_id: lessonId,
          completed: true,
          student_id: user.uid,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )

      setProgress((current) => ({
        ...current,
        [lessonId]: true,
      }))
    } catch (err) {
      console.error('Progress update error:', err)

      setError('Unable to save your progress right now. Please check your connection and try again.')
    }
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">
        Loading…
      </div>
    )
  }

  if (status === 'no_access') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">
          No access yet
        </h1>

        <p className="mt-3 text-slate-muted">
          {error ??
            "You're not enrolled in this course, or your payment hasn't been verified yet."}
        </p>

        {courseId && (
          <button
            onClick={() =>
              navigate(`/courses/${slug}`)
            }
            className="btn-primary mt-6"
          >
            View course details
          </button>
        )}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-danger">
          Unable to connect
        </h1>

        <p className="mt-3 text-slate-muted">
          {error ?? 'Please check your internet connection and try again.'}
        </p>

        <button
          onClick={() => setRetryToken((t) => t + 1)}
          className="btn-primary mt-6"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">
          {courseName}
        </h1>

        <span className="text-sm text-slate-muted">
          {percentComplete}% complete
        </span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger">{error}</p>
      )}

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gold"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {modules.map((module) => (
            <div
              key={module.id}
              className="mb-2"
            >
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
                {module.title}
              </p>

              {lessons
                .filter(
                  (lesson) =>
                    lesson.module_id === module.id
                )
                .map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() =>
                      setActiveLessonId(lesson.id)
                    }
                    className={`flex w-full items-center gap-2 rounded-card px-2 py-2 text-left text-sm ${
                      lesson.id === activeLessonId
                        ? 'bg-gold/15 text-gold-bright'
                        : 'text-parchment/90 hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        progress[lesson.id]
                          ? 'bg-success'
                          : 'bg-white/20'
                      }`}
                    />

                    {lesson.title}
                  </button>
                ))}
            </div>
          ))}

          {lessons.length === 0 && (
            <p className="p-3 text-sm text-slate-muted">
              No lessons published yet.
            </p>
          )}
        </aside>

        <section className="card p-6">
          {!activeLesson && (
            <p className="text-slate-muted">
              Select a lesson to begin.
            </p>
          )}

          {activeLesson && (
            <>
              <h2 className="font-display text-xl">
                {activeLesson.title}
              </h2>

              {activeLesson.video_url && (
                <video
                  controls
                  className="mt-4 w-full rounded-card bg-black"
                  src={activeLesson.video_url}
                />
              )}

              {activeLesson.pdf_url && (
                <a
                  href={activeLesson.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary mt-4 inline-flex"
                >
                  Open PDF
                </a>
              )}

              {activeLesson.content && (
                <p className="mt-4 whitespace-pre-line text-parchment/90">
                  {activeLesson.content}
                </p>
              )}

              <button
                onClick={() =>
                  markComplete(activeLesson.id)
                }
                disabled={progress[activeLesson.id]}
                className="btn-primary mt-6 disabled:opacity-50"
              >
                {progress[activeLesson.id]
                  ? 'Completed'
                  : 'Mark as complete'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
