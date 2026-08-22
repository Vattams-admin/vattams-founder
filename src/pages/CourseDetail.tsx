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
import CourseCard from '@/components/CourseCard'

const LEVEL_LABELS: Record<NonNullable<Course['level']>, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  professional: 'Professional',
}

type CourseState = 'loading' | 'ready' | 'not_found' | 'error'

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>()

  const [course, setCourse] = useState<Course | null>(null)
  const [state, setState] = useState<CourseState>('loading')
  const [related, setRelated] = useState<Course[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!slug) {
        setState('not_found')
        return
      }

      setState('loading')

      try {
        // Same Firestore query this page has always used — only the
        // presentation below changes.
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true),
          limit(1)
        )

        const snapshot = await getDocs(coursesQuery)

        if (cancelled) return

        if (snapshot.empty) {
          setState('not_found')
          return
        }

        const docSnap = snapshot.docs[0]
        const data = { id: docSnap.id, ...docSnap.data() } as Course

        setCourse(data)
        setState('ready')

        // Related courses: only derived from real data (same category_id,
        // published, excluding this course itself). If category_id isn't
        // set on this course, no related section is shown — nothing here
        // is invented.
        if (data.category_id) {
          try {
            const relatedQuery = query(
              collection(firestore, 'courses'),
              where('is_published', '==', true),
              where('category_id', '==', data.category_id)
            )
            const relatedSnap = await getDocs(relatedQuery)
            if (cancelled) return
            const relatedRows = relatedSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as Course)
              .filter((c) => c.id !== data.id)
              .slice(0, 3)
            setRelated(relatedRows)
          } catch {
            // Related courses are a bonus, not core functionality —
            // fail silently rather than blocking the page.
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load course:', err)
        setState('error')
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [slug])

  async function handleEnroll() {
    if (!course) return

    if (!user) {
      navigate('/login', {
        state: {
          redirectTo: `/courses/${slug}`,
        },
      })
      return
    }

    setEnrolling(true)
    setEnrollError(null)

    // Free courses activate immediately.
    // Paid courses go through the existing payment/UTR flow.
    // Price is always read live from Firestore course data — unchanged.

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
          await addDoc(collection(firestore, 'course_enrolments'), {
            student_id: user.uid,
            course_id: course.id,
            status: 'active',
            enrolled_at: new Date().toISOString(),
          })
        }

        setEnrolling(false)
        navigate('/dashboard')
      } catch (err) {
        setEnrolling(false)
        setEnrollError(
          err instanceof Error ? err.message : 'Could not enrol in this course.'
        )
      }

      return
    }

    setEnrolling(false)
    navigate(`/pay/${course.id}`)
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="card h-10 w-32 animate-pulse" />
        <div className="card mt-4 h-10 w-2/3 animate-pulse" />
        <div className="card mt-8 h-40 animate-pulse" />
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl">Course not found</h1>
        <p className="mt-2 text-slate-muted">
          This course may have been unpublished or the link may be incorrect.
        </p>
        <a href="/courses" className="btn-primary mt-6 inline-flex">
          Browse all courses
        </a>
      </div>
    )
  }

  if (state === 'error' || !course) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl text-danger">Couldn&apos;t load this course</h1>
        <p className="mt-2 text-slate-muted">Please refresh the page or try again shortly.</p>
      </div>
    )
  }

  const finalPrice = Math.max(course.base_fee - course.discount_amount, 0)

  // Only fields that actually exist on this course are shown below —
  // nothing here is a guaranteed claim (no accreditation, placement, or
  // affiliation copy, since none of that exists in the data model).
  const infoItems = [
    course.duration_text && { label: 'Duration', value: course.duration_text },
    course.level && { label: 'Level', value: LEVEL_LABELS[course.level] },
    course.instructor_name && { label: 'Instructor', value: course.instructor_name },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div>
      {/* Course hero */}
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
          {course.level && (
            <span className="w-fit rounded-full border border-gold/30 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-gold">
              {LEVEL_LABELS[course.level]}
            </span>
          )}

          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {course.name}
          </h1>

          {course.instructor_name && (
            <p className="mt-2 text-sm text-slate-muted">Taught by {course.instructor_name}</p>
          )}

          {course.short_description && (
            <p className="mt-4 max-w-2xl text-parchment/90">{course.short_description}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="font-display text-2xl text-gold-bright">
              {course.is_free ? 'Free' : `₹${finalPrice.toLocaleString('en-IN')}`}
            </span>
            {course.discount_amount > 0 && !course.is_free && (
              <span className="text-sm text-slate-muted line-through">
                ₹{course.base_fee.toLocaleString('en-IN')}
              </span>
            )}
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="btn-primary disabled:opacity-60"
            >
              {enrolling ? 'Please wait…' : course.is_free ? 'Enrol for free' : 'Enrol and pay'}
            </button>
          </div>

          {enrollError && <p className="mt-3 text-sm text-danger">{enrollError}</p>}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Overview */}
          <div className="lg:col-span-2">
            {(course.description || course.short_description) && (
              <section>
                <h2 className="font-display text-xl text-gold-bright">Course overview</h2>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-parchment/90">
                  {course.description ?? course.short_description}
                </p>
              </section>
            )}

            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-xl text-gold-bright">Related courses</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {related.map((r) => (
                    <CourseCard key={r.id} course={r} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: course information */}
          <aside className="lg:col-span-1">
            {infoItems.length > 0 && (
              <div className="card divide-y divide-white/10">
                <h2 className="p-4 font-display text-base text-gold-bright">Course information</h2>
                {infoItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-4 text-sm">
                    <span className="text-slate-muted">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="card mt-6 p-5 text-center">
              <p className="text-sm text-slate-muted">Programme fee</p>
              <p className="mt-1 font-display text-2xl">
                {course.is_free ? 'Free' : `₹${finalPrice.toLocaleString('en-IN')}`}
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="btn-primary mt-4 w-full disabled:opacity-60"
              >
                {enrolling ? 'Please wait…' : course.is_free ? 'Enrol for free' : 'Enrol and pay'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}