import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import CourseCard from '@/components/CourseCard'
import { useSeo, SITE_URL } from '@/hooks/useSeo'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getPricingConfig } from '@/lib/pricingConfig'

export default function CompetitiveExams() {
  useSeo({
    title: 'Competitive Exam Preparation | VATTAMS ACADEMIA',
    description: 'Explore VATTAMS ACADEMIA competitive exam preparation for TNPSC, SSC, Banking, Railway, Police, Defence, UGC NET/SET, TET and other major exams.',
    path: '/competitive-exams',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Competitive Exam Preparation',
      url: `${SITE_URL}/competitive-exams`,
      description: 'Competitive exam preparation programmes from VATTAMS ACADEMIA.',
      isPartOf: { '@type': 'WebSite', name: 'VATTAMS ACADEMIA', url: SITE_URL },
    },
  })

  const [courses, setCourses] = useState<Course[]>([])
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [retryToken, setRetryToken] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)

  const filteredCourses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return courses
    return courses.filter((course) => [course.name, course.slug, course.short_description ?? '', course.description ?? ''].join(' ').toLowerCase().includes(term))
  }, [courses, searchTerm])

  useEffect(() => {
    let cancelled = false
    getPricingConfig().then((config) => {
      if (!cancelled) setPricingConfig(config)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState('loading')
      try {
        const snapshot = await getDocs(query(
          collection(firestore, 'courses'),
          where('is_published', '==', true),
        ))
        if (cancelled) return
        const rows = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Course)
          .filter((course) => !course.is_competition && course.category_id === 'competitive-exams')
          .sort((a, b) => a.name.localeCompare(b.name))
        setCourses(rows)
        setState('loaded')
      } catch (error) {
        console.error('Failed to load competitive exam programmes:', error)
        if (!cancelled) setState('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [retryToken])

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="eyebrow">Competitive Exams</p>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-5xl">
            Competitive exam preparation built for serious learners
          </h1>
          <p className="mt-4 max-w-2xl text-parchment/90">
            Explore structured preparation programmes for TNPSC, SSC, Banking, Railway, Police,
            Defence, UGC NET/SET, TET and other competitive examinations.
          </p>
        </div>
      </section>

      <section className="border-y border-white/5 bg-white/[0.02] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="eyebrow">Explore exam pathways</p>
          <h2 className="mt-2 text-xl font-semibold text-parchment">Find preparation by goal</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-muted">These are discovery topics, not a claim that every programme is currently published. Select a topic to open the existing course catalogue with that search.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              'TNPSC', 'UPSC', 'SSC', 'Banking', 'Railways', 'Police & Defence',
              'JEE & Engineering', 'NEET & Medical', 'CUET & University Entrance',
              'Law & Management', 'Pharmacy & Agriculture', 'CA & Auditing',
            ].map((topic) => (
              <Link key={topic} to={`/courses?search=${encodeURIComponent(topic)}`} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-medium text-parchment/85 transition-colors hover:border-azure/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure focus-visible:ring-offset-2 focus-visible:ring-offset-navy">
                {topic}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {state === 'loading' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => <div key={i} className="card h-72 animate-pulse" />)}
          </div>
        )}
        {state === 'error' && (
          <div className="card p-8 text-center">
            <h2 className="font-display text-xl">Couldn’t load programmes</h2>
            <p className="mt-2 text-sm text-slate-muted">Please try again.</p>
            <button type="button" onClick={() => setRetryToken((token) => token + 1)} className="btn-secondary mt-5">Retry</button>
          </div>
        )}
        {state === 'loaded' && courses.length === 0 && (
          <div className="card p-8 text-center">
            <h2 className="font-display text-xl">No competitive exam programmes are published yet</h2>
            <p className="mt-2 text-sm text-slate-muted">Explore the full course catalogue while new programmes are added.</p>
            <Link to="/courses" className="btn-primary mt-5 inline-flex">Explore Courses</Link>
          </div>
        )}
        {state === 'loaded' && courses.length > 0 && (
          <>
            <div className="mb-6">
              <label htmlFor="exam-programme-search" className="sr-only">Search published exam programmes</label>
              <input id="exam-programme-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search published programmes by exam or topic…" className="input w-full max-w-xl" />
            </div>
            {filteredCourses.length === 0 ? (
              <div className="card p-8 text-center">
                <h2 className="font-display text-xl">No matching programmes</h2>
                <p className="mt-2 text-sm text-slate-muted">Try another exam name or clear your search.</p>
                <button type="button" onClick={() => setSearchTerm('')} className="btn-secondary mt-5">Show all programmes</button>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-muted" aria-live="polite">Showing {filteredCourses.length} of {courses.length} published {courses.length === 1 ? 'programme' : 'programmes'}</p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((course) => <CourseCard key={course.id} course={course} pricingConfig={pricingConfig} />)}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
