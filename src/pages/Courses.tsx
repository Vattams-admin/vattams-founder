import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import CourseCard from '@/components/CourseCard'

export default function Courses() {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('is_published', '==', true)
        )

        const snapshot = await getDocs(coursesQuery)

        if (cancelled) return

        const rows = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Course[]

        rows.sort((a, b) => {
          if (a.is_featured === b.is_featured) return 0
          return a.is_featured ? -1 : 1
        })

        setCourses(rows)
      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load courses right now.'
        )
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">Courses</h1>

      <p className="mt-2 text-slate-muted">
        Browse published courses. Prices update live from admin settings.
      </p>

      {error && (
        <div className="mt-8 card border-danger/40 p-6 text-danger">
          Couldn't load courses right now. {error}
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

      {courses !== null && courses.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
