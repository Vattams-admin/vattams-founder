import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import CourseCard from '@/components/CourseCard'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { CATALOG_CATEGORIES } from '@/lib/catalog'

type LoadState = 'loading' | 'loaded' | 'error'

const LEVEL_LABELS: Record<NonNullable<Course['level']>, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  professional: 'Professional',
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState('loading')
      try {
        // Same collection, same field, same Course type as before —
        // only the presentation below changes.
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('is_published', '==', true)
        )

        const snapshot = await getDocs(coursesQuery)

        if (cancelled) return

        // VATTAMS Competitions live in the same `courses` collection
        // (same pricing/publish architecture) but are entered from the
        // dedicated /competitions page, not bought here as a tutor-led
        // course — so they're excluded from this grid.
        const rows = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((c) => !(c as Course).is_competition) as Course[]

        rows.sort((a, b) => {
          if (a.is_featured === b.is_featured) return 0
          return a.is_featured ? -1 : 1
        })

        setCourses(rows)
        setState('loaded')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load courses:', err)
        setState('error')
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [retryToken])

  // Only built from levels that actually appear in the loaded data — no
  // invented categories, no hardcoded taxonomy. Level is populated on
  // some rows and not others, so this list only ever shows values that
  // are actually in use.
  const availableLevels = useMemo(() => {
    const found = new Set<string>()
    for (const c of courses) {
      if (c.level) found.add(c.level)
    }
    return Array.from(found) as NonNullable<Course['level']>[]
  }, [courses])

  // Same idea for category_id, restricted to the known catalog category
  // slugs (src/lib/catalog.ts) — older/unrelated rows with no category_id
  // or an unrecognized value simply don't add a chip, they still show up
  // under "All categories".
  const availableCategories = useMemo(() => {
    const found = new Set<string>()
    for (const c of courses) {
      if (c.category_id) found.add(c.category_id)
    }
    return CATALOG_CATEGORIES.filter((cat) => found.has(cat.id))
  }, [courses])

  const filteredCourses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return courses.filter((c) => {
      if (levelFilter !== 'all' && c.level !== levelFilter) return false
      if (categoryFilter !== 'all' && c.category_id !== categoryFilter) return false

      if (!term) return true

      const haystack = [getCourseDisplayName(c.name), c.name, c.short_description, c.description, c.instructor_name, c.subject]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })
  }, [courses, searchTerm, levelFilter, categoryFilter])

  return (
    <div>
      {/* Premium hero */}
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="font-display text-xs uppercase tracking-[0.4em] text-gold sm:text-sm">
            Course Catalogue
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Explore Courses
          </h1>
          <p className="mt-4 max-w-2xl text-parchment/90">
            Structured learning across academics, competitive-exam preparation, professional skills,
            and certification — every course priced and published live from VATTAMS ACADEMIA.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Search + filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">Search courses</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search courses by name or topic…"
              className="input pl-10"
            />
          </label>

          {availableLevels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={levelFilter === 'all'} onClick={() => setLevelFilter('all')}>
                All levels
              </FilterChip>
              {availableLevels.map((level) => (
                <FilterChip key={level} active={levelFilter === level} onClick={() => setLevelFilter(level)}>
                  {LEVEL_LABELS[level]}
                </FilterChip>
              ))}
            </div>
          )}
        </div>

        {availableCategories.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
              All categories
            </FilterChip>
            {availableCategories.map((cat) => (
              <FilterChip key={cat.id} active={categoryFilter === cat.id} onClick={() => setCategoryFilter(cat.id)}>
                {cat.label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="mt-10 card border-danger/40 p-8 text-center">
            <p className="font-display text-lg text-danger">Couldn&apos;t load courses</p>
            <p className="mt-2 text-sm text-slate-muted">
              Something went wrong on our end. Please refresh the page or check back shortly.
            </p>
            <button onClick={() => setRetryToken((t) => t + 1)} className="btn-secondary mt-5">
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-72 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty states */}
        {state === 'loaded' && courses.length === 0 && (
          <div className="mt-10 card p-10 text-center">
            <p className="font-display text-lg">No courses published yet</p>
            <p className="mt-2 text-sm text-slate-muted">Check back soon — new courses are added regularly.</p>
          </div>
        )}

        {state === 'loaded' && courses.length > 0 && filteredCourses.length === 0 && (
          <div className="mt-10 card p-10 text-center">
            <p className="font-display text-lg">No courses match your search</p>
            <p className="mt-2 text-sm text-slate-muted">Try a different keyword or clear the level filter.</p>
            <button
              onClick={() => {
                setSearchTerm('')
                setLevelFilter('all')
                setCategoryFilter('all')
              }}
              className="btn-secondary mt-5"
            >
              Clear search &amp; filters
            </button>
          </div>
        )}

        {/* Results */}
        {state === 'loaded' && filteredCourses.length > 0 && (
          <>
            <p className="mt-8 text-sm text-slate-muted">
              {filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'} available
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? 'border-gold bg-gold/15 text-gold-bright'
          : 'border-white/15 text-slate-muted hover:border-gold/40 hover:text-parchment'
      }`}
    >
      {children}
    </button>
  )
}