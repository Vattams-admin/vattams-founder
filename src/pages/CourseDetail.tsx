import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Course } from '@/types/database'

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>()

  const [course, setCourse] = useState<Course | null | 'not_found'>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!slug) {
        setCourse('not_found')
        return
      }

      try {
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true),
          limit(1)
        )

        const snapshot = await getDocs(coursesQuery)

        if (cancelled) return

        if (snapshot.empty) {
          setCourse('not_found')
          return
        }

        const docSnap = snapshot.docs[0]

        const data = {
          id: docSnap.id,
          ...docSnap.data(),
        } as Course

        setCourse(data)
      } catch (err) {
        if (cancelled) return

        setError(
          err instanceof Error
            ? err.message
            : 'Could not load course.'
        )
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleEnroll() {
    if (!course || course === 'not_found') return

    if (!user) {
      navigate('/login', {
        state: {
          redirectTo: `/courses/${slug}`,
        },
      })
      return
    }

    setEnrolling(true)
    setError(null)

    // Free courses activate immediately.
    // Paid courses go through the payment/UTR flow.
    // Price is always read live from Firestore courses data.

    if (course.is_free) {
      try {
        const enrolmentQuery = query(
          collection(firestore, 'course_enrolments'),
          where('student_id', '==', user.uid),
          where('course_id', '==', course.id),
          limit(1)
        )

        const snapshot = await getDocs(enrolmentQuery)

        if (!snapshot.empty) {
          await updateDoc(snapshot.docs[0].ref, {
            status: 'active',
            enrolled_at: new Date().toISOString(),
          })
        } else {
          await addDoc(
            collection(firestore, 'course_enrolments'),
            {
              student_id: user.uid,
              course_id: course.id,
              status: 'active',
              enrolled_at: new Date().toISOString(),
            }
          )
        }

        setEnrolling(false)
        navigate('/dashboard')
      } catch (err) {
        setEnrolling(false)
        setError(
          err instanceof Error
            ? err.message
            : 'Could not enrol in this course.'
        )
      }

      return
    }

    setEnrolling(false)
    navigate(`/pay/${course.id}`)
  }

  if (course === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-slate-muted">
        Loading…
      </div>
    )
  }

  if (course === 'not_found') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        Course not found.
      </div>
    )
  }

  const finalPrice = Math.max(
    course.base_fee - course.discount_amount,
    0
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {course.level && (
        <span className="w-fit rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
          {course.level}
        </span>
      )}

      <h1 className="mt-3 font-display text-3xl">
        {course.name}
      </h1>

      {course.instructor_name && (
        <p className="mt-1 text-sm text-slate-muted">
          Taught by {course.instructor_name}
        </p>
      )}

      <p className="mt-6 text-parchment/90">
        {course.description ?? course.short_description}
      </p>

      <div className="card mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-muted">
            Programme fee
          </p>

          <p className="font-display text-2xl">
            {course.is_free
              ? 'Free'
              : `₹${finalPrice.toLocaleString('en-IN')}`}
          </p>

          {course.discount_amount > 0 && !course.is_free && (
            <p className="text-xs text-slate-muted">
              <span className="line-through">
                ₹{course.base_fee.toLocaleString('en-IN')}
              </span>{' '}
              — discount applied
            </p>
          )}
        </div>

        <button
          onClick={handleEnroll}
          disabled={enrolling}
          className="btn-primary disabled:opacity-60"
        >
          {enrolling
            ? 'Please wait…'
            : course.is_free
              ? 'Enrol for free'
              : 'Enrol and pay'}
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
