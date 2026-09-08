import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { getCategoryLabel } from '@/lib/catalog'
import { useSeo, SITE_URL } from '@/hooks/useSeo'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getPricingConfig } from '@/lib/pricingConfig'
import { getEffectiveCoursePricing, describePricing } from '@/lib/coursePricing'

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error'

// Same Firestore `courses` collection and query shape as Courses.tsx —
// fetched by slug instead of listing all published courses. This page
// previously contained a stray copy-paste of CourseCard.tsx (a card
// linking back to its own route), so "Enrol" went nowhere. It now loads
// the real course and links Enrol to the existing /pay/:courseId route,
// which already handles the login redirect for unauthenticated students.
export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)

  useEffect(() => {
    let cancelled = false
    getPricingConfig()
      .then((c) => { if (!cancelled) setPricingConfig(c) })
      .catch(() => { /* falls back to defaults */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!slug) {
        setState('not-found')
        return
      }
      setState('loading')
      try {
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('slug', '==', slug),
          where('is_published', '==', true)
        )
        const snapshot = await getDocs(coursesQuery)
        if (cancelled) return

        if (snapshot.empty) {
          setState('not-found')
          return
        }

        const docSnap = snapshot.docs[0]
        setCourse({ id: docSnap.id, ...docSnap.data() } as Course)
        setState('loaded')
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
  }, [slug, retryToken])

  const displayNameForSeo = course ? getCourseDisplayName(course.name) : undefined

  useSeo({
    title: displayNameForSeo ?? 'Course',
    description:
      course?.short_description ??
      (course?.subject
        ? `Learn ${course.subject} with this course on VATTAMS ACADEMIA — structured lessons, progress tracking and a verifiable certificate on completion.`
        : 'Explore this course on VATTAMS ACADEMIA — structured lessons, progress tracking and a verifiable certificate on completion.'),
    path: slug ? `/courses/${slug}` : '/courses',
    noindex: state !== 'loaded',
    type: 'website',
    image: course?.cover_image_url || undefined,
    jsonLd:
      state === 'loaded' && course
        ? {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: displayNameForSeo,
            description: course.short_description ?? course.description ?? undefined,
            ...(course.subject ? { about: { '@type': 'Thing', name: course.subject } } : {}),
            ...(course.level ? { educationalLevel: course.level } : {}),
            provider: {
              '@type': 'EducationalOrganization',
              name: 'VATTAMS ACADEMIA',
              sameAs: SITE_URL,
            },
          }
        : undefined,
  })

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  if (state === 'not-found') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg">Course not found</p>
        <p className="mt-2 text-sm text-slate-muted">
          This course may have been unpublished or the link is incorrect.
        </p>
        <Link to="/courses" className="btn-secondary mt-6 inline-flex">
          Browse all courses
        </Link>
      </div>
    )
  }

  if (state === 'error' || !course) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p className="font-display text-lg text-danger">Couldn&apos;t load this course</p>
        <p className="mt-2 text-sm text-slate-muted">
          Something went wrong on our end. Please refresh the page or check back shortly.
        </p>
        <button onClick={() => setRetryToken((t) => t + 1)} className="btn-secondary mt-6">
          Retry
        </button>
      </div>
    )
  }

  const pricing = getEffectiveCoursePricing(course, pricingConfig)
  const displayName = getCourseDisplayName(course.name)
  const categoryLabel = getCategoryLabel(course.category_id)

  return (
    <div>
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          {(categoryLabel || course.level) && (
            <div className="flex flex-wrap gap-1.5">
              {categoryLabel && (
                <span className="w-fit rounded-full border border-white/25 px-2 py-0.5 text-[11px] uppercase tracking-wide text-parchment/80">
                  {categoryLabel}
                </span>
              )}
              {course.level && (
                <span className="w-fit rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
                  {course.level}
                </span>
              )}
            </div>
          )}
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {displayName}
          </h1>
          {course.short_description && (
            <p className="mt-4 max-w-2xl text-parchment/90">{course.short_description}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-[1.6fr_1fr]">
          <div>
            {course.description && (
              <div className="card p-6">
                <h2 className="font-display text-lg">About this course</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-muted">
                  {course.description}
                </p>
              </div>
            )}

            {(course.instructor_name || course.duration_text) && (
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                {course.instructor_name && (
                  <div>
                    <dt className="text-slate-muted">Instructor</dt>
                    <dd className="mt-1 font-medium">{course.instructor_name}</dd>
                  </div>
                )}
                {course.duration_text && (
                  <div>
                    <dt className="text-slate-muted">Duration</dt>
                    <dd className="mt-1 font-medium">{course.duration_text}</dd>
                  </div>
                )}
              </dl>
            )}

            {course.preview_video_url && (
              <div className="card mt-6 p-6">
                <h2 className="font-display text-lg">Preview</h2>
                <a
                  href={course.preview_video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary mt-3 inline-flex"
                >
                  Watch preview video
                </a>
              </div>
            )}
          </div>

          <div className="card h-fit p-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-parchment">
                {pricing.mode === 'free' ? 'Free' : describePricing(pricing)}
              </span>
              {pricing.mode === 'special_offer' && pricing.regularAmount != null && pricing.regularAmount !== pricing.amount && (
                <span className="text-xs text-slate-muted line-through">
                  ₹{pricing.regularAmount.toLocaleString('en-IN')}
                </span>
              )}
              {(pricing.mode === 'legacy' || pricing.mode === 'competition_entry') && course.discount_amount > 0 && (
                <span className="text-xs text-slate-muted line-through">
                  ₹{course.base_fee.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {pricing.isRecurring && (
              <p className="mt-2 text-xs text-slate-muted">
                Billed monthly. VATTAMS does not charge your card/UPI automatically — you&apos;ll submit each
                month&apos;s payment yourself.
              </p>
            )}

            <Link to={`/pay/${course.id}`} className="btn-primary mt-4 flex w-full justify-center">
              {course.is_competition ? 'Register now' : 'Enrol now'}
            </Link>
            <p className="mt-3 text-center text-xs text-slate-muted">
              You&apos;ll be asked to log in or register first if you haven&apos;t already.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
