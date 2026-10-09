import { useSeo, SITE_URL } from '@/hooks/useSeo'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getPricingConfig } from '@/lib/pricingConfig'
import { getEffectiveCoursePricing } from '@/lib/coursePricing'

type LoadState = 'loading' | 'loaded' | 'error'

const COMPETITION_DISCOVERY_TOPICS = [
  'Thirukkural',
  'Classical Literature',
  'Language & Literature',
  'Mathematics',
  'Science',
  'Reasoning',
  'General Knowledge',
  'Technology',
] as const

// VATTAMS Competitions are catalog rows in the same Firestore `courses`
// collection as every other course (same pricing/publish architecture,
// see src/lib/catalog.ts and scripts/seed-catalog.mjs), just flagged
// with is_competition: true so they never show up in the main Courses
// grid or its purchase-as-a-course flow. This page is their own listing;
// each entry still links into the existing /courses/:slug detail page
// and /pay/:courseId flow — nothing new was built for enrolment/payment.
export default function Competitions() {
  useSeo({
    title: 'Academic Competitions | VATTAMS ACADEMIA',
    description: 'Explore VATTAMS ACADEMIA academic competitions and knowledge championships with structured preparation, mock tests and verifiable certificates.',
    path: '/competitions',
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'VATTAMS ACADEMIA Academic Competitions', url: `${SITE_URL}/competitions`, isPartOf: { '@type': 'WebSite', name: 'VATTAMS ACADEMIA', url: SITE_URL } },
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const [competitions, setCompetitions] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '')
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)

  // Keep competition searches shareable and in sync with browser navigation.
  useEffect(() => {
    const nextSearch = searchTerm.trim()
    setSearchParams((current) => {
      if ((current.get('search') ?? '') === nextSearch) return current
      const next = new URLSearchParams(current)
      if (nextSearch) next.set('search', nextSearch)
      else next.delete('search')
      return next
    }, { replace: true })
  }, [searchTerm, setSearchParams])

  useEffect(() => {
    const querySearch = searchParams.get('search') ?? ''
    if (querySearch !== searchTerm) setSearchTerm(querySearch)
  }, [searchParams, searchTerm])

  const filteredCompetitions = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase()
    if (!term) return competitions
    return competitions.filter((competition) => {
      const searchableText = [
        getCourseDisplayName(competition.name),
        competition.name,
        competition.slug,
        competition.short_description ?? '',
        competition.description ?? '',
      ].join(' ').toLocaleLowerCase()
      return searchableText.includes(term)
    })
  }, [competitions, searchTerm])

  useEffect(() => {
    let cancelled = false
    getPricingConfig()
      .then((config) => { if (!cancelled) setPricingConfig(config) })
      .catch(() => { /* falls back to defaults */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState('loading')
      try {
        const competitionsQuery = query(
          collection(firestore, 'courses'),
          where('is_published', '==', true),
          where('is_competition', '==', true)
        )
        const snapshot = await getDocs(competitionsQuery)
        if (cancelled) return

        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Course[]
        rows.sort((a, b) => getCourseDisplayName(a.name).localeCompare(getCourseDisplayName(b.name)))

        setCompetitions(rows)
        setState('loaded')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load competitions:', err)
        setState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [retryToken])

  return (
    <div>
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          <p className="font-display text-xs uppercase tracking-[0.4em] text-gold sm:text-sm">
            VATTAMS Competitions
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Knowledge-based competitions
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-parchment/90">
            Timed academic competitions and knowledge championships, open for registration below.
            Pricing is set and updated by VATTAMS ACADEMIA and always shown live.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {state === 'error' && (
          <div className="card border-danger/40 p-8 text-center">
            <p className="font-display text-lg text-danger">Couldn&apos;t load competitions</p>
            <p className="mt-2 text-sm text-slate-muted">
              Something went wrong on our end. Please refresh the page or check back shortly.
            </p>
            <button onClick={() => setRetryToken((t) => t + 1)} className="btn-secondary mt-5">
              Retry
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-40 animate-pulse" />
            ))}
          </div>
        )}

        {state === 'loaded' && competitions.length > 0 && (
          <section aria-labelledby="competition-discovery-title" className="mb-8">
            <div className="mb-4">
              <p className="eyebrow">Find your interest</p>
              <h2 id="competition-discovery-title" className="mt-2 font-display text-2xl font-semibold">
                Explore competitions by topic
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-muted">
                Search and topic shortcuts filter the published competitions currently listed below.
                They do not imply that a separate competition is available for every topic.
              </p>
            </div>
            <label htmlFor="competition-search" className="sr-only">Search published competitions</label>
            <input
              id="competition-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search competition name or description"
              className="input w-full max-w-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {COMPETITION_DISCOVERY_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSearchTerm(topic)}
                  aria-pressed={searchTerm === topic}
                  className={`rounded-full border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${searchTerm === topic ? 'border-gold bg-gold/15 text-gold' : 'border-white/15 text-parchment hover:border-gold/50'}`}
                >
                  {topic}
                </button>
              ))}
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="rounded-full px-3 py-2 text-sm text-slate-muted underline underline-offset-4 hover:text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                >
                  Clear search
                </button>
              )}
            </div>
          </section>
        )}

        {state === 'loaded' && competitions.length === 0 && (
          <div className="card p-10 text-center">
            <p className="font-display text-lg">No competitions open right now</p>
            <p className="mt-2 text-sm text-slate-muted">Check back soon, or explore courses in the meantime.</p>
            <Link to="/courses" className="btn-primary mt-6 inline-flex">
              Explore Courses
            </Link>
          </div>
        )}

        {state === 'loaded' && competitions.length > 0 && filteredCompetitions.length === 0 && (
          <div className="card p-8 text-center">
            <p className="font-display text-lg">No matching competitions found</p>
            <p className="mt-2 text-sm text-slate-muted">
              Try another keyword or clear the search to see all published competitions.
            </p>
            <button type="button" onClick={() => setSearchTerm('')} className="btn-secondary mt-5">
              Show all competitions
            </button>
          </div>
        )}

        {state === 'loaded' && filteredCompetitions.length > 0 && (
          <>
            <p className="mb-4 text-sm text-slate-muted" aria-live="polite">
              Showing {filteredCompetitions.length} of {competitions.length} published {competitions.length === 1 ? 'competition' : 'competitions'}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompetitions.map((c) => {
                const pricing = getEffectiveCoursePricing(c, pricingConfig)
                const finalPrice = pricing.amount
                return (
                  <Link key={c.id} to={`/courses/${c.slug}`} className="card group flex flex-col gap-2 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy">
                    <h3 className="font-display text-lg leading-snug">{getCourseDisplayName(c.name)}</h3>
                    {c.short_description && (
                      <p className="line-clamp-2 text-sm text-slate-muted">{c.short_description}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="font-semibold text-parchment">
                        {c.is_free ? 'Free' : `₹${finalPrice.toLocaleString('en-IN')}`}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold group-hover:text-gold-bright">
                        Details →
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
