import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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
  const [status, setStatus] = useState<'loading' | 'no_access' | 'ready'>('loading')

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login', { state: { redirectTo: `/learn/${slug}` } }); return }

    let cancelled = false
    async function load() {
      const { data: course, error: courseErr } = await supabase
        .from('courses').select('id, name').eq('slug', slug).single()
      if (cancelled) return
      if (courseErr || !course) { setError('Course not found.'); setStatus('no_access'); return }
      setCourseId(course.id)
      setCourseName(course.name)

      const { data: enrolment } = await supabase
        .from('course_enrolments').select('id').eq('student_id', user!.id).eq('course_id', course.id).eq('status', 'active').maybeSingle()
      if (cancelled) return
      if (!enrolment) { setStatus('no_access'); return }
      setEnrolmentId(enrolment.id)

      const { data: moduleRows } = await supabase
        .from('course_modules').select('id, title, sort_order').eq('course_id', course.id).order('sort_order')
      const { data: lessonRows } = await supabase
        .from('course_lessons').select('id, title, video_url, pdf_url, content, sort_order, module_id')
        .in('module_id', (moduleRows ?? []).map((m) => m.id)).order('sort_order')
      const { data: progressRows } = await supabase
        .from('course_progress').select('lesson_id, completed').eq('enrolment_id', enrolment.id)

      if (cancelled) return
      setModules(moduleRows ?? [])
      setLessons((lessonRows as Lesson[]) ?? [])
      setProgress(Object.fromEntries((progressRows as ProgressRow[] ?? []).map((p) => [p.lesson_id, p.completed])))
      // Resume at the first incomplete lesson, or the first lesson.
      const firstIncomplete = (lessonRows as Lesson[] ?? []).find((l) => !(progressRows ?? []).some((p) => p.lesson_id === l.id && p.completed))
      setActiveLessonId(firstIncomplete?.id ?? (lessonRows as Lesson[])?.[0]?.id ?? null)
      setStatus('ready')
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user, authLoading])

  const activeLesson = useMemo(() => lessons.find((l) => l.id === activeLessonId) ?? null, [lessons, activeLessonId])
  const percentComplete = lessons.length
    ? Math.round((100 * lessons.filter((l) => progress[l.id]).length) / lessons.length)
    : 0

  async function markComplete(lessonId: string) {
    if (!enrolmentId) return
    await supabase.from('course_progress').upsert(
      { enrolment_id: enrolmentId, lesson_id: lessonId, completed: true },
      { onConflict: 'enrolment_id,lesson_id' }
    )
    setProgress((p) => ({ ...p, [lessonId]: true }))
  }

  if (status === 'loading') return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>

  if (status === 'no_access') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">No access yet</h1>
        <p className="mt-3 text-slate-muted">
          {error ?? "You're not enrolled in this course, or your payment hasn't been verified yet."}
        </p>
        {courseId && (
          <button onClick={() => navigate(`/courses/${slug}`)} className="btn-primary mt-6">View course details</button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{courseName}</h1>
        <span className="text-sm text-slate-muted">{percentComplete}% complete</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gold" style={{ width: `${percentComplete}%` }} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {modules.map((m) => (
            <div key={m.id} className="mb-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gold">{m.title}</p>
              {lessons.filter((l) => l.module_id === m.id).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLessonId(l.id)}
                  className={`flex w-full items-center gap-2 rounded-card px-2 py-2 text-left text-sm ${
                    l.id === activeLessonId ? 'bg-gold/15 text-gold-bright' : 'text-parchment/90 hover:bg-white/5'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${progress[l.id] ? 'bg-success' : 'bg-white/20'}`} />
                  {l.title}
                </button>
              ))}
            </div>
          ))}
          {lessons.length === 0 && <p className="p-3 text-sm text-slate-muted">No lessons published yet.</p>}
        </aside>

        <section className="card p-6">
          {!activeLesson && <p className="text-slate-muted">Select a lesson to begin.</p>}
          {activeLesson && (
            <>
              <h2 className="font-display text-xl">{activeLesson.title}</h2>
              {activeLesson.video_url && (
                <video controls className="mt-4 w-full rounded-card bg-black" src={activeLesson.video_url} />
              )}
              {activeLesson.pdf_url && (
                <a href={activeLesson.pdf_url} target="_blank" rel="noreferrer" className="btn-secondary mt-4 inline-flex">
                  Open PDF
                </a>
              )}
              {activeLesson.content && <p className="mt-4 whitespace-pre-line text-parchment/90">{activeLesson.content}</p>}

              <button
                onClick={() => markComplete(activeLesson.id)}
                disabled={progress[activeLesson.id]}
                className="btn-primary mt-6 disabled:opacity-50"
              >
                {progress[activeLesson.id] ? 'Completed' : 'Mark as complete'}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
