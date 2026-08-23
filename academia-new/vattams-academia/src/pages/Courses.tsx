import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Course } from '@/types/database'
import CourseCard from '@/components/CourseCard'

export default function Courses() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('is_featured', { ascending: false })

      if (cancelled) return
      if (error) setError(error.message)
      else setCourses(data as unknown as Course[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Courses</h1>
      <p className="mt-2 text-slate-muted">Browse published courses. Prices update live from admin settings.</p>

      {error && (
        <div className="mt-8 card border-danger/40 p-6 text-danger">
          Couldn&apos;t load courses right now. {error}
        </div>
      )}

      {!error && courses === null && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-64 animate-pulse" />
          ))}
        </div>
      )}

      {courses !== null && courses.length === 0 && (
        <div className="mt-8 card p-8 text-center text-slate-muted">
          No courses published yet. Check back soon.
        </div>
      )}

      {courses && courses.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
