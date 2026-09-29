import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error'

export default function CompetitionParticipant() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading } = useAuth()

  const [course, setCourse] = useState<Course | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [hasActiveEnrolment, setHasActiveEnrolment] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !slug) return

      setState('loading')

      try {
        const courseQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true)
        )

        const courseSnapshot = await getDocs(courseQuery)

        if (cancelled) return

        if (courseSnapshot.empty) {
          setState('not-found')
          return
        }

        const courseDoc = courseSnapshot.docs[0]
        const loadedCourse = {
          id: courseDoc.id,
          ...courseDoc.data(),
        } as Course

        if (!loadedCourse.is_competition) {
          setState('not-found')
          return
        }

        const enrolmentRef = doc(
          firestore,
          'enrolments',
          `${user.uid}_${loadedCourse.id}`
        )

        const enrolmentSnapshot = await getDoc(enrolmentRef)

        if (cancelled) return

        if (
          !enrolmentSnapshot.exists() ||
          enrolmentSnapshot.data().status !== 'active'
        ) {
          setHasActiveEnrolment(false)
          setCourse(loadedCourse)
          setState('loaded')
          return
        }

        setCourse(loadedCourse)
        setHasActiveEnrolment(true)
        setState('loaded')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load competition participant page:', err)
        setState('error')
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user, slug])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ redirectTo: `/competition/${slug}` }} replace />
  }

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (state === 'not-found' || !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Competition not found</p>
        <Link to="/competitions" className="btn-secondary mt-6 inline-flex">
          Browse competitions
        </Link>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg text-danger">
          Couldn&apos;t load this competition
        </p>
        <p className="mt-2 text-sm text-slate-muted">
          Please refresh the page and try again.
        </p>
      </div>
    )
  }

  const displayName = getCourseDisplayName(course.name)

  if (!hasActiveEnrolment) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Registration required</p>
        <p className="mt-2 text-sm text-slate-muted">
          You do not have an active registration for this competition.
        </p>
        <Link
          to={`/courses/${course.slug}`}
          className="btn-primary mt-6 inline-flex"
        >
          View competition
        </Link>
      </div>
    )
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />

        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="w-fit rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
            Competition
          </span>

          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {displayName}
          </h1>

          <p className="mt-4 max-w-2xl text-parchment/90">
            Your registration is active. This is your competition participant
            area.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-muted">Registration status</p>
              <p className="mt-1 font-semibold text-success">ACTIVE</p>
            </div>

            <span className="rounded-full bg-success/20 px-3 py-1 text-xs uppercase tracking-wide text-success">
              Registered
            </span>
          </div>

          <div className="mt-8 rounded-card border border-gold/15 bg-white/5 p-5">
            <h2 className="font-display text-lg">Competition access</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-muted">
              Your registration has been confirmed. The competition attempt
              interface will appear here when the competition is published and
              made available for participation.
            </p>

            <div className="mt-5 rounded-card border border-white/10 p-4">
              <p className="text-sm font-medium">Status</p>
              <p className="mt-1 text-sm text-slate-muted">
                Competition questions are not currently available for an active
                attempt.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn-secondary">
              Back to dashboard
            </Link>
            <Link to="/competitions" className="btn-secondary">
              View competitions
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
