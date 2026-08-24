import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import type { Course } from '@/types/database'

type LoadState = 'loading' | 'loaded' | 'error'

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setState('loading')
    try {
      // No `where` here on purpose — the admin needs to see drafts too,
      // not just is_published: true rows (that filter is what the
      // public Courses.tsx page applies).
      const snapshot = await getDocs(collection(firestore, 'courses'))
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Course[]
      rows.sort((a, b) => a.name.localeCompare(b.name))
      setCourses(rows)
      setState('loaded')
    } catch (err) {
      console.error('Failed to load courses:', err)
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return courses
    return courses.filter((c) =>
      [c.name, c.slug, c.instructor_name].filter(Boolean).join(' ').toLowerCase().includes(term)
    )
  }, [courses, search])

  async function togglePublish(course: Course) {
    setBusyId(course.id)
    setError(null)
    try {
      await updateDoc(doc(firestore, 'courses', course.id), { is_published: !course.is_published })
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c))
      )
    } catch (err) {
      console.error('Failed to update publish status:', err)
      setError('Unable to save that change right now. Please check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(course: Course) {
    if (!window.confirm(`Delete "${course.name}"? This cannot be undone.`)) return
    setBusyId(course.id)
    setError(null)
    try {
      await deleteDoc(doc(firestore, 'courses', course.id))
      setCourses((prev) => prev.filter((c) => c.id !== course.id))
    } catch (err) {
      console.error('Failed to delete course:', err)
      setError('Unable to delete right now. Please check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="courses" />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Courses</h1>
        <Link to="/admin/courses/new" className="btn-primary text-sm">
          New course
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, slug, or instructor…"
        className="input mt-4 max-w-sm"
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {state === 'error' && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Unable to connect</p>
          <p className="mt-2 text-sm text-slate-muted">
            Please check your internet connection and try again.
          </p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'loaded' && filtered.length === 0 && (
        <p className="mt-8 text-sm text-slate-muted">
          {courses.length === 0 ? 'No courses yet.' : 'No courses match your search.'}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {state === 'loaded' &&
          filtered.map((course) => (
            <div key={course.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">{course.name}</p>
                <p className="text-slate-muted">
                  /{course.slug} · {course.is_free ? 'Free' : `₹${course.base_fee.toLocaleString('en-IN')}`}
                  {course.instructor_name ? ` · ${course.instructor_name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    course.is_published ? 'bg-success/20 text-success' : 'bg-gold/20 text-gold'
                  }`}
                >
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
                <button
                  onClick={() => togglePublish(course)}
                  disabled={busyId === course.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <Link to={`/admin/courses/${course.id}`} className="btn-secondary text-xs">
                  Edit
                </Link>
                <button
                  onClick={() => remove(course)}
                  disabled={busyId === course.id}
                  className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}