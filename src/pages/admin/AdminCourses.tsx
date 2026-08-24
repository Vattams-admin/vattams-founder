import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import AdminNav from '@/components/AdminNav'
import type { Course } from '@/types/database'

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoadError(false)
    try {
      const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
      if (error) {
        console.error('Failed to load courses:', error)
        setLoadError(true)
        return
      }
      setCourses(data as unknown as Course[])
    } catch (err) {
      console.error('Unexpected error loading courses:', err)
      setLoadError(true)
    }
  }

  useEffect(() => { load() }, [])

  async function togglePublish(course: Course) {
    setError(null)
    try {
      const { error } = await supabase.from('courses').update({ is_published: !course.is_published }).eq('id', course.id)
      if (error) {
        console.error('Failed to update course publish state:', error)
        setError('Unable to save this change right now. Please check your connection and try again.')
      } else {
        load()
      }
    } catch (err) {
      console.error('Unexpected error updating course publish state:', err)
      setError('Unable to save this change right now. Please check your connection and try again.')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="courses" />
      <div className="mt-6 flex items-center justify-between">
        <h1 className="font-display text-3xl">Courses</h1>
        <Link to="/admin/courses/new" className="btn-primary">New course</Link>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {loadError && (
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

      {!loadError && courses === null && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}
      {!loadError && courses?.length === 0 && <p className="mt-8 text-sm text-slate-muted">No courses yet. Create the first one.</p>}

      <div className="mt-6 divide-y divide-white/10 rounded-card border border-white/10">
        {!loadError && courses?.map((c) => {
          const finalPrice = Math.max(c.base_fee - c.discount_amount, 0)
          return (
            <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-muted">
                  {c.is_free ? 'Free' : `₹${finalPrice.toLocaleString('en-IN')}`} · {c.level ?? 'no level set'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${c.is_published ? 'bg-success/20 text-success' : 'bg-white/10 text-slate-muted'}`}>
                  {c.is_published ? 'Published' : 'Draft'}
                </span>
                <button onClick={() => togglePublish(c)} className="btn-secondary text-xs">
                  {c.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <Link to={`/admin/courses/${c.id}`} className="btn-secondary text-xs">Edit</Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
