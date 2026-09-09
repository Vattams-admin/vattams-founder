import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getPricingConfig } from '@/lib/pricingConfig'
import { getEffectiveCoursePricing } from '@/lib/coursePricing'

type LoadState = 'loading' | 'loaded' | 'error'

// VATTAMS Competitions are catalog rows in the same Firestore `courses`
// collection as every other course (same pricing/publish architecture,
// see src/lib/catalog.ts and scripts/seed-catalog.mjs), just flagged
// with is_competition: true so they never show up in the main Courses
// grid or its purchase-as-a-course flow. This page is their own listing;
// each entry still links into the existing /courses/:slug detail page
// and /pay/:courseId flow — nothing new was built for enrolment/payment.
export default function Competitions() {
  const [competitions, setCompetitions] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)

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

        {state === 'loaded' && competitions.length === 0 && (
            <div className="card p-10 text-center">
            <p className="font-display text-lg">No competitions open right now</p>
            <p className="mt-2 text-sm text-slate-muted">Check back soon, or explore courses in the meantime.</p>
            <Link to="/courses" className="btn-primary mt-6 inline-flex">
              Explore Courses
            </Link>
          </div>
        )}

        {state === 'loaded' && competitions.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {competitions.map((c) => {
              const pricing = getEffectiveCoursePricing(c, pricingConfig)
              const finalPrice = pricing.amount
              return (
                <Link key={c.id} to={`/courses/${c.slug}`} className="card group flex flex-col gap-2 p-5">
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
        )}
      </div>
    </div>
  )
}
