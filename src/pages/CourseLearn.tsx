import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { listPublishedMaterials } from '@/lib/materials'
import { createCourseMaterialDownloadUrl } from '@/lib/supabaseStorage'
import type { Material } from '@/types/materials'
import { getMaterialTypeLabel } from '@/types/materials'
import { formatFileSize } from '@/lib/materialValidation'
import { MaterialTypeIcon } from '@/components/materials/MaterialIcons'
import MaterialViewerModal from '@/components/materials/MaterialViewerModal'
import AssessmentCatalog from '@/components/assessment/AssessmentCatalog'

interface Course {
  id: string
  name: string
  slug: string
  is_published?: boolean
}

interface Lesson {
  id: string
  title: string
  // Private Supabase Storage paths — a signed URL is requested on
  // demand (see loadActiveLessonFiles below) rather than trusting
  // video_url/pdf_url, which the admin upload flow always leaves null
  // for a private bucket (see AdminCourseContent.tsx).
  video_path: string | null
  pdf_path: string | null
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

// Lesson `content` is normally plain text typed into a simple textarea
// (see AdminCourseContent.tsx), but some lessons are bulk-authored and
// store a JSON-encoded structured object in that same field instead —
// title/objective/core_teaching_content/examples/etc. This type only
// describes the fields we know how to render; anything else in the
// object (course_id, module_id, lesson_id, sort_order, status, ...)
// is intentionally left untyped here and never rendered.
interface StructuredLessonContent {
  objective?: unknown
  core_teaching_content?: unknown
  examples?: unknown
  practical_activity?: unknown
  independent_practice?: unknown
  assessment_checkpoint?: unknown
  student_task?: unknown
  tutor_guidance?: unknown
  materials_requirement?: unknown
  reflection_completion?: unknown
  daily_flow?: unknown
  [key: string]: unknown
}

// Order mirrors the fields as they appear in the bulk-authored lesson
// JSON. `title` is intentionally excluded — the lesson's own title is
// already shown in the page heading, so repeating it here would just
// duplicate it. Internal metadata (course_id/module_id/lesson_id/
// sort_order/status) is excluded by simply not being in this list.
const STRUCTURED_LESSON_FIELDS: Array<{
  key: keyof StructuredLessonContent
  label: string
}> = [
  { key: 'objective', label: 'Objective' },
  { key: 'core_teaching_content', label: 'Lesson' },
  { key: 'examples', label: 'Examples' },
  { key: 'practical_activity', label: 'Practical Activity' },
  { key: 'independent_practice', label: 'Independent Practice' },
  { key: 'assessment_checkpoint', label: 'Assessment Checkpoint' },
  { key: 'student_task', label: 'Student Task' },
  { key: 'tutor_guidance', label: 'Tutor Guidance' },
  { key: 'materials_requirement', label: 'Materials Needed' },
  { key: 'reflection_completion', label: 'Reflection & Completion' },
  { key: 'daily_flow', label: 'Daily Flow' },
]

// Never throws: any parse failure or unexpected shape returns null so
// the caller falls back to rendering the original text untouched —
// plain-text lesson content keeps working exactly as before.
function parseStructuredLessonContent(
  raw: string
): StructuredLessonContent | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const record = parsed as Record<string, unknown>
    const hasKnownField = STRUCTURED_LESSON_FIELDS.some(
      ({ key }) => record[key as string] != null
    )

    return hasKnownField ? (record as StructuredLessonContent) : null
  } catch {
    return null
  }
}

// Renders one field's value as readable UI: strings become paragraphs
// (whitespace preserved), arrays become bullet lists (recursing per
// item so an array of objects still shows readable text rather than
// "[object Object]"), and anything else falls back to a plain string.
// No dangerouslySetInnerHTML anywhere.
function renderLessonFieldValue(value: unknown) {
  if (value == null) return null

  if (typeof value === 'string') {
    if (!value.trim()) return null
    return <p className="whitespace-pre-line text-parchment/90">{value}</p>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="list-disc space-y-1 pl-5 text-parchment/90">
        {value.map((item, index) => (
          <li key={index} className="whitespace-pre-line">
            {typeof item === 'string' || typeof item === 'number'
              ? String(item)
              : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return null
    return (
      <ul className="space-y-1 text-parchment/90">
        {entries.map(([entryKey, entryValue]) => (
          <li key={entryKey}>
            <span className="font-medium">
              {entryKey.replace(/_/g, ' ')}:{' '}
            </span>
            {typeof entryValue === 'string'
              ? entryValue
              : JSON.stringify(entryValue)}
          </li>
        ))}
      </ul>
    )
  }

  return <p className="text-parchment/90">{String(value)}</p>
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
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null)
  const [progressSaveRetryId, setProgressSaveRetryId] = useState<string | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [revisionChecks, setRevisionChecks] = useState<Record<string, boolean[]>>({})
  const [lessonFileUrls, setLessonFileUrls] = useState<{
    video: string | null
    pdf: string | null
  }>({ video: null, pdf: null })
  const [lessonFilesLoading, setLessonFilesLoading] = useState(false)
  const [lessonFilesError, setLessonFilesError] = useState<string | null>(null)
  const [lessonFilesRetryToken, setLessonFilesRetryToken] = useState(0)
  const [viewerMaterial, setViewerMaterial] = useState<Material | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<
    'loading' | 'no_access' | 'error' | 'ready'
  >('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)

  const filteredMaterials = useMemo(() => {
    const term = materialSearch.trim().toLocaleLowerCase()
    if (!term) return materials
    return materials.filter((material) =>
      [material.title, getMaterialTypeLabel(material.type)]
        .some((value) => value.toLocaleLowerCase().includes(term))
    )
  }, [materials, materialSearch])


  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate('/login', {
        state: { redirectTo: `/learn/${slug}` },
      })
      return
    }

    let cancelled = false
    const currentUser = user
    const userId = currentUser.uid

    async function load() {
      let currentStep = 'initializing CourseLearn'
      try {
        setError(null)
        setDiagnosticError(null)
        setStatus('loading')

        // ---------------------------------------------------------
        // 1. Find published course by slug
        // ---------------------------------------------------------
        const courseQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true)
        )

        currentStep = 'Step 1: loading course'
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

        currentStep = 'Step 2: checking active enrolment'
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
          where('course_id', '==', course.id)
        )

        currentStep = 'Step 3: loading course modules'
        const moduleSnapshot = await getDocs(moduleQuery)

        const moduleRows: Module[] = moduleSnapshot.docs
          .map((doc) => {
            const data = doc.data()

            return {
              id: doc.id,
              title: data.title ?? '',
              sort_order: data.sort_order ?? 0,
            }
          })
          .sort((a, b) => a.sort_order - b.sort_order)

        if (cancelled) return

        // ---------------------------------------------------------
        // 4. Load lessons for each module
        // ---------------------------------------------------------
        const lessonRows: Lesson[] = []

        for (const module of moduleRows) {
          const lessonQuery = query(
            collection(firestore, 'course_lessons'),
            where('module_id', '==', module.id),
            where('course_id', '==', course.id)
          )

          currentStep = `Step 4: loading lessons for module ${module.id}`
          const lessonSnapshot = await getDocs(lessonQuery)

          lessonSnapshot.docs.forEach((lessonDoc) => {
            const data = lessonDoc.data()

            lessonRows.push({
              id: lessonDoc.id,
              title: data.title ?? '',
              video_path: data.video_path ?? null,
              pdf_path: data.pdf_path ?? null,
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

        currentStep = 'Step 5: loading progress'
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

        lessonRows.sort((a, b) => {
          const moduleOrder =
            moduleRows.find((module) => module.id === a.module_id)?.sort_order ?? 0
          const otherModuleOrder =
            moduleRows.find((module) => module.id === b.module_id)?.sort_order ?? 0

          return moduleOrder - otherModuleOrder || a.sort_order - b.sort_order
        })

        // ---------------------------------------------------------
        // 6b. Course materials (Learning Materials module — separate
        // from lessons; see src/lib/materials.ts). Non-fatal: a
        // failure here (e.g. a permission issue specific to that
        // subcollection) must not block the lesson view students
        // already have access to.
        // ---------------------------------------------------------
        currentStep = 'Step 6: loading course materials'
        const { rows: materialRows } = await listPublishedMaterials(course.id)
        if (!cancelled) setMaterials(materialRows)

        // ---------------------------------------------------------
        // 7. Update state
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

        const firebaseError = err as { code?: string; message?: string }
        setDiagnosticError(
          firebaseError.code
            ? `${currentStep} — ${firebaseError.code}: ${firebaseError.message ?? 'Unknown Firebase error'}`
            : `${currentStep} — ${String(err)}`
        )

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

  // If `content` is a JSON-encoded structured lesson, this holds the
  // parsed object; otherwise null, and the raw text is rendered as
  // before (see the render block below).
  const structuredLessonContent = useMemo(
    () =>
      activeLesson?.content
        ? parseStructuredLessonContent(activeLesson.content)
        : null,
    [activeLesson?.content]
  )

  // Lesson video/PDF live in a private Supabase Storage bucket — there
  // is no public URL to render directly. A signed URL is requested
  // through the course-material Edge Function whenever the selected
  // lesson has a video_path/pdf_path, and is never persisted anywhere
  // (it's short-lived by design; see supabase/functions/course-material).
  useEffect(() => {
    const videoPath = activeLesson?.video_path ?? null
    const pdfPath = activeLesson?.pdf_path ?? null

    if (!videoPath && !pdfPath) {
      setLessonFileUrls({ video: null, pdf: null })
      setLessonFilesError(null)
      setLessonFilesLoading(false)
      return
    }

    let cancelled = false

    async function loadActiveLessonFiles() {
      // Clear the previous lesson's short-lived signed URLs immediately;
      // never leave stale media available while the next lesson is loading.
      setLessonFileUrls({ video: null, pdf: null })
      setLessonFilesLoading(true)
      setLessonFilesError(null)

      try {
        const [video, pdf] = await Promise.all([
          videoPath ? createCourseMaterialDownloadUrl(videoPath) : Promise.resolve(null),
          pdfPath ? createCourseMaterialDownloadUrl(pdfPath) : Promise.resolve(null),
        ])

        if (!cancelled) {
          setLessonFileUrls({ video, pdf })
        }
      } catch (err) {
        console.error('Failed to load lesson file URL:', err)
        if (!cancelled) {
          setLessonFileUrls({ video: null, pdf: null })
          setLessonFilesError(
            'Unable to load this lesson\u2019s video/PDF right now. Please try again.'
          )
        }
      } finally {
        if (!cancelled) setLessonFilesLoading(false)
      }
    }

    loadActiveLessonFiles()

    return () => {
      cancelled = true
    }
  }, [activeLesson?.id, activeLesson?.video_path, activeLesson?.pdf_path, lessonFilesRetryToken])

  const activeLessonIndex = lessons.findIndex((lesson) => lesson.id === activeLessonId)
  const previousLesson = activeLessonIndex > 0 ? lessons[activeLessonIndex - 1] : null
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1
    ? lessons[activeLessonIndex + 1]
    : null
  const completedLessonCount = lessons.filter((lesson) => progress[lesson.id]).length
  const nextIncompleteLesson = lessons.find((lesson) => !progress[lesson.id]) ?? null
  const currentModule = activeLesson
    ? modules.find((module) => module.id === activeLesson.module_id) ?? null
    : null
  const currentModuleLessons = currentModule
    ? lessons.filter((lesson) => lesson.module_id === currentModule.id)
    : []
  const currentModuleCompletedCount = currentModuleLessons.filter((lesson) => progress[lesson.id]).length

  const percentComplete = lessons.length
    ? Math.round(
        (100 *
          lessons.filter((lesson) => progress[lesson.id]).length) /
          lessons.length
      )
    : 0

  async function markComplete(lessonId: string) {
    if (!enrolmentId || !user || progress[lessonId] || progressSavingId) return

    setProgressSavingId(lessonId)
    setProgressSaveRetryId(null)
    setError(null)
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
      setProgressSaveRetryId(null)
    } catch (err) {
      console.error('Progress update error:', err)
      setProgressSaveRetryId(lessonId)
      setError('Unable to save your progress right now. Please check your connection and try again.')
    } finally {
      setProgressSavingId(null)
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
        {diagnosticError && (
          <p className="mt-3 break-all text-xs text-slate-muted">
            Diagnostic: {diagnosticError}
          </p>
        )}

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl">
          {courseName}
        </h1>

        <div className="text-right">
          <p className="text-sm font-semibold text-parchment">{percentComplete}% complete</p>
          <p className="text-xs text-slate-muted">{completedLessonCount} of {lessons.length} lessons</p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-danger" role="alert">
          <p>{error}</p>
          {progressSaveRetryId && (
            <button
              type="button"
              onClick={() => void markComplete(progressSaveRetryId)}
              disabled={progressSavingId !== null}
              className="btn-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
            >
              {progressSavingId === progressSaveRetryId ? 'Retrying save…' : 'Retry progress save'}
            </button>
          )}
        </div>
      )}

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Course completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentComplete}
      >
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${percentComplete}%` }} />
      </div>

      {nextIncompleteLesson && nextIncompleteLesson.id !== activeLessonId && (
        <button
          type="button"
          onClick={() => setActiveLessonId(nextIncompleteLesson.id)}
          className="mt-3 text-sm font-medium text-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Continue learning: {nextIncompleteLesson.title}
        </button>
      )}
      {nextIncompleteLesson && activeLessonId === nextIncompleteLesson.id && (
        <p className="mt-3 text-sm text-slate-muted" role="status">
          You’re on your next incomplete lesson. Mark it complete when you’re ready to record your progress.
        </p>
      )}
      {!nextIncompleteLesson && lessons.length > 0 && (
        <p className="mt-3 text-sm text-slate-muted" role="status">
          All lessons completed. You can revisit any lesson from the list.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {modules.map((module) => (
            <div
              key={module.id}
              className="mb-2"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                  {module.title}
                </p>
                <span className="text-[11px] tabular-nums text-slate-muted">
                  {lessons.filter((lesson) => lesson.module_id === module.id && progress[lesson.id]).length}/
                  {lessons.filter((lesson) => lesson.module_id === module.id).length}
                </span>
              </div>

              {lessons
                .filter(
                  (lesson) =>
                    lesson.module_id === module.id
                )
                .map((lesson, lessonIndex) => (
                  <button
                    key={lesson.id}
                    onClick={() =>
                      setActiveLessonId(lesson.id)
                    }
                    aria-current={lesson.id === activeLessonId ? 'step' : undefined}
                    className={`flex w-full items-center gap-2 rounded-card px-2 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                      lesson.id === activeLessonId
                        ? 'bg-gold/15 text-gold-bright'
                        : 'text-parchment/90 hover:bg-white/5'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        progress[lesson.id]
                          ? 'bg-success/15 text-success'
                          : lesson.id === activeLessonId
                            ? 'bg-gold/20 text-gold-bright'
                            : 'bg-white/5 text-slate-muted'
                      }`}
                    >
                      {progress[lesson.id] ? '✓' : lessonIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">{lesson.title}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-muted">
                      {progress[lesson.id] ? 'Done' : lesson.id === activeLessonId ? 'Current' : 'Next'}
                    </span>
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
              {currentModule && (
                <p className="mt-2 text-sm text-slate-muted" aria-live="polite" aria-atomic="true">
                  Module: {currentModule.title} · {currentModuleCompletedCount} of {currentModuleLessons.length} lessons completed
                </p>
              )}

              {lessonFilesLoading && (activeLesson.video_path || activeLesson.pdf_path) && (
                <p className="mt-4 text-sm text-slate-muted">
                  Loading video/PDF…
                </p>
              )}

              {!lessonFilesLoading && lessonFilesError && (
                <div className="mt-4 rounded-card border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
                  {lessonFilesError}
                  <button
                    type="button"
                    onClick={() => setLessonFilesRetryToken((t) => t + 1)}
                    className="btn-secondary ml-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!lessonFilesLoading && !lessonFilesError && lessonFileUrls.video && (
                <video
                  controls
                  aria-label={`Lesson video: ${activeLesson.title}`}
                  preload="metadata"
                  className="mt-4 w-full rounded-card bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  src={lessonFileUrls.video}
                />
              )}

              {!lessonFilesLoading && !lessonFilesError && lessonFileUrls.pdf && (
                <a
                  href={lessonFileUrls.pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary mt-4 inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={`Open PDF for lesson: ${activeLesson.title}`}
                >
                  Open PDF
                </a>
              )}

              {activeLesson.content && !structuredLessonContent && (
                <p className="mt-4 whitespace-pre-line text-parchment/90">
                  {activeLesson.content}
                </p>
              )}

              {structuredLessonContent && (
                <div className="mt-4 space-y-5">
                  {STRUCTURED_LESSON_FIELDS.map(({ key, label }) => {
                    const rendered = renderLessonFieldValue(
                      structuredLessonContent[key]
                    )
                    if (!rendered) return null

                    return (
                      <section
                        key={key}
                        aria-labelledby={`lesson-section-${key}`}
                        className="rounded-card border border-white/10 bg-black/10 p-4"
                      >
                        <h3
                          id={`lesson-section-${key}`}
                          className="text-xs font-semibold uppercase tracking-wide text-gold"
                        >
                          {label}
                        </h3>
                        <div className="mt-2 leading-7">{rendered}</div>
                      </section>
                    )
                  })}
                </div>
              )}

              <section className="mt-6 rounded-card border border-gold/20 bg-gold/5 p-4" aria-labelledby="lesson-revision-heading">
                <h3 id="lesson-revision-heading" className="font-semibold">Before you finish this lesson</h3>
                <p className="mt-1 text-sm text-slate-muted">
                  {structuredLessonContent
                    ? 'Use the authored lesson sections below as your revision guide. This checklist is a personal reminder and does not mark the lesson complete.'
                    : 'Use this quick revision checklist to consolidate what you learned. This checklist is a personal reminder and does not mark the lesson complete.'}
                </p>
                {(() => {
                  const items = [
                    {
                      available: Boolean(structuredLessonContent?.objective),
                      text: 'Revisit the lesson objective and explain the main idea in your own words.',
                      fallback: 'Explain the main idea in your own words.',
                    },
                    {
                      available: Boolean(structuredLessonContent?.examples),
                      text: 'Work through the authored examples and explain each key step.',
                      fallback: 'Review the examples, key terms and any study material provided.',
                    },
                    {
                      available: Boolean(structuredLessonContent?.independent_practice || structuredLessonContent?.practical_activity || structuredLessonContent?.assessment_checkpoint),
                      text: 'Complete the available practice, activity or assessment checkpoint.',
                      fallback: 'Try the practice or assessment questions, if available.',
                    },
                    {
                      available: Boolean(structuredLessonContent?.reflection_completion),
                      text: 'Use the authored reflection prompt to identify what you understand and what needs revision.',
                      fallback: 'Identify one point you need to revise before moving on.',
                    },
                  ]
                  const checks = revisionChecks[activeLesson.id] ?? []
                  const checkedCount = items.filter((_, index) => checks[index]).length
                  return (
                    <>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-muted" aria-live="polite" aria-atomic="true">
                          {checkedCount} of {items.length} revision steps checked
                        </p>
                        {checkedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setRevisionChecks((current) => ({
                              ...current,
                              [activeLesson.id]: [],
                            }))}
                            className="text-xs text-slate-muted underline underline-offset-4 hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                          >
                            Reset checklist
                          </button>
                        )}
                      </div>
                      <ul className="mt-3 space-y-3 text-sm">
                        {items.map((item, index) => (
                          <li key={index}>
                            <label className="flex cursor-pointer items-start gap-3 rounded-card border border-white/10 p-3 hover:bg-white/5">
                              <input
                                type="checkbox"
                                checked={Boolean(checks[index])}
                                onChange={(event) => setRevisionChecks((current) => {
                                  const lessonChecks = [...(current[activeLesson.id] ?? [])]
                                  lessonChecks[index] = event.target.checked
                                  return { ...current, [activeLesson.id]: lessonChecks }
                                })}
                                className="mt-1 h-4 w-4 shrink-0 accent-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                              />
                              <span>{item.available ? item.text : item.fallback}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )
                })()}
                <p className="mt-3 text-xs text-slate-muted">
                  These checks are kept only in the current page session; course completion is tracked separately.
                </p>
              </section>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={() => previousLesson && setActiveLessonId(previousLesson.id)}
                  disabled={!previousLesson}
                  className="btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous lesson
                </button>
                <button
                  type="button"
                  onClick={() => markComplete(activeLesson.id)}
                  disabled={progress[activeLesson.id] || progressSavingId !== null}
                  aria-busy={progressSavingId === activeLesson.id}
                  className="btn-primary disabled:opacity-50"
                >
                  {progress[activeLesson.id]
                    ? 'Completed'
                    : progressSavingId === activeLesson.id
                      ? 'Saving progress…'
                      : 'Mark as complete'}
                </button>
                <button
                  type="button"
                  onClick={() => nextLesson && setActiveLessonId(nextLesson.id)}
                  disabled={!nextLesson}
                  className="btn-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next lesson
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-muted" aria-live="polite" aria-atomic="true">
                {activeLessonIndex >= 0 ? `Lesson ${activeLessonIndex + 1} of ${lessons.length}` : 'Choose a lesson'}
                {progress[activeLesson.id] ? ' · Completed' : ''}
              </p>
            </>
          )}
        </section>
      </div>

      {courseId && <AssessmentCatalog courseId={courseId} />}

      <section className="card mt-6 p-6" aria-labelledby="course-materials-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="course-materials-heading" className="font-display text-lg">Course Materials</h2>
              <p className="mt-1 text-xs text-slate-muted" aria-live="polite" aria-atomic="true">
                Showing {filteredMaterials.length} of {materials.length} resources
              </p>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
              <label className="sr-only" htmlFor="course-material-search">Search course materials</label>
              <input
                id="course-material-search"
                type="search"
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
                placeholder="Search title or type…"
                className="input min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              />
              {materialSearch && (
                <button
                  type="button"
                  onClick={() => setMaterialSearch('')}
                  className="btn-secondary text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {materials.length === 0 ? (
            <div className="mt-4 rounded-card border border-white/10 p-5 text-sm" role="status">
              <p className="font-medium">No course materials published yet</p>
              <p className="mt-1 text-slate-muted">Published notes, videos and other resources will appear here when they are available for this course.</p>
            </div>
          ) : filteredMaterials.length > 0 ? (
            <div className="mt-4 space-y-2">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-white/10 p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-card bg-gold/15 text-gold">
                      <MaterialTypeIcon type={material.type} />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-medium">{material.title}</p>
                      <p className="text-xs text-slate-muted">
                        {getMaterialTypeLabel(material.type)}
                        {material.file_size ? ` · ${formatFileSize(material.file_size)}` : ''}
                      </p>
                    </div>
                  </div>
                  {material.type === 'link' ? (
                    material.url && (
                      <a href={material.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                        Open
                      </a>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewerMaterial(material)}
                      className="btn-secondary text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                    >
                      {material.type === 'notes' ? 'Read' : 'Open'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-card border border-white/10 p-5 text-sm" role="status">
              <p className="font-medium">No matching materials</p>
              <p className="mt-1 text-slate-muted">Try another title or resource type.</p>
              <button
                type="button"
                onClick={() => setMaterialSearch('')}
                className="btn-secondary mt-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
              >
                Show all materials
              </button>
            </div>
          )}
      </section>

      {viewerMaterial && (
        <MaterialViewerModal
          material={viewerMaterial}
          onClose={() => setViewerMaterial(null)}
        />
      )}
    </div>
  )
}
