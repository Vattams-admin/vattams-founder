import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useSeo, SITE_URL } from '@/hooks/useSeo'
import type { Course } from '@/types/database'
import CourseCard from '@/components/CourseCard'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getPricingConfig } from '@/lib/pricingConfig'
import { ACADEMIA_PILLARS } from '@/lib/academiaPillars'

// NOTE ON DATA SOURCES (read this before touching this file again):
// Courses are the only offering with a working data layer right now —
// Courses.tsx already fetches them straight from Firestore's `courses`
// collection, so Featured Courses below mirrors that exact pattern
// (same collection, same `Course` type from '@/types/database', same
// CourseCard). There is currently no working fetch layer anywhere in the
// query, no card component) — inventing one here would mean guessing a
// collection/table shape that may not match what admin eventually builds.
// So the Competitive Exams and Competitions sections below are static
// premium sections using only copy that already exists elsewhere in this
// app (About.tsx, the original Home.tsx), linking to their real routes.
// Swap them for live cards once `/exams` and `/competitions` have an
// actual data source — the section wrappers are already structured to
// take a card grid in place of the static content.

const categories = [
  {
    title: 'Academic Courses',
    body: 'Structured, syllabus-aligned courses with lessons, modules, and progress tracking.',
    to: '/courses',
    icon: IconGraduationCap
  },
  {
    title: 'Competitive Exams',
    body: 'TNPSC, UPSC, SSC, Banking, Railway, Police, Defence, UGC NET/SET and TET preparation.',
    to: '/competitive-exams',
    icon: IconTarget
  },
  {
    title: 'Competitions',
    body: 'Timed academic competitions with public leaderboards and eligible-finisher certificates.',
    to: '/competitions',
    icon: IconTrophy
  },
  {
    title: 'Professional & Skill Courses',
    body: 'Career-focused, skill-building courses designed for practical, real-world application.',
    to: '/courses',
    icon: IconBriefcase
  },
  {
    title: 'Certifications',
    body: 'Every certificate carries a unique number, instantly verifiable by anyone, anywhere.',
    to: '/verify-certificate',
    icon: IconBadgeCheck
  }
]

const whyVattams = [
  {
    title: 'Structured learning',
    body: 'Every course is organised into clear modules and lessons, so progress always has a next step.'
  },
  {
    title: 'Quality learning resources',
    body: 'Study material built for depth, not filler — written to actually prepare you, not just fill a page.'
  },
  {
    title: 'Competitive exam preparation',
    body: 'Subject-wise question banks and timed mock tests built to mirror the real exam pattern.'
  },
  {
    title: 'Knowledge competitions',
    body: 'Timed academic competitions with public leaderboards, open to every enrolled student.'
  },
  {
    title: 'Verifiable certifications',
    body: 'Every certificate carries a unique number anyone can verify publicly, instantly, no login required.'
  },
  {
    title: 'Student-focused experience',
    body: 'Transparent, live pricing and a platform built around one goal: helping you actually learn.'
  }
]

const journeySteps = [
  { step: '01', title: 'Discover', body: 'Browse courses, exam programmes, and competitions across the platform.' },
  { step: '02', title: 'Enrol', body: 'Pay securely by UPI and submit your reference to activate enrolment.' },
  { step: '03', title: 'Learn', body: 'Work through structured lessons and modules at your own pace.' },
  { step: '04', title: 'Practice', body: 'Test yourself with subject-wise question banks and timed mock exams.' },
  { step: '05', title: 'Compete', body: 'Take part in timed competitions and see where you stand on the leaderboard.' },
  { step: '06', title: 'Certify', body: 'Earn a certificate carrying a unique number anyone can verify publicly.' }
]

export default function Home() {
  useSeo({
    title: 'VATTAMS ACADEMIA — Courses, Exams & Competitions',
    description:
      'VATTAMS ACADEMIA is an India-focused education platform offering structured courses, competitive exam preparation, academic competitions, and verifiable certificates.',
    path: '/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: 'VATTAMS ACADEMIA',
        url: SITE_URL,
        logo: `${SITE_URL}/branding/logo.png`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'VATTAMS ACADEMIA',
        url: SITE_URL,
      },
    ],
  })

  const [courses, setCourses] = useState<Course[] | null>(null)
  // Fetched once, best-effort — see CourseCard's own fallback to
  // DEFAULT_PRICING_CONFIG if this hasn't resolved yet or fails.
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)

  useEffect(() => {
    let cancelled = false
    getPricingConfig()
      .then((c) => { if (!cancelled) setPricingConfig(c) })
      .catch(() => { /* CourseCard falls back to defaults */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadFeaturedCourses() {
      try {
        const coursesQuery = query(
          collection(firestore, 'courses'),
          where('is_published', '==', true),
          where('is_featured', '==', true)
        )
        const snapshot = await getDocs(coursesQuery)
        if (cancelled) return
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Course[]
        setCourses(rows.slice(0, 3))
      } catch {
        if (!cancelled) setCourses([])
      }
    }

    loadFeaturedCourses()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      {/* Premium hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
        <div
          className="pointer-events-none absolute -right-24 top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-azure/20 blur-[110px] sm:block motion-safe:animate-pulse"
          style={{ animationDuration: '6s' }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="font-display text-sm font-medium tracking-wide text-azure-bright sm:text-base">
            Learn &middot; Compete &middot; Certify &middot; Grow
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.1] sm:text-6xl">
            An international-standard education platform, built to prepare you for what&apos;s next.
          </h1>
          <p className="mt-6 max-w-xl text-base text-parchment/80 sm:text-lg">
            VATTAMS ACADEMIA brings academic and professional courses, competitive exam preparation,
            knowledge competitions, and verifiable certification together on one institution-grade
            platform.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-primary">Explore Courses</Link>
            <Link to="/competitions" className="btn-secondary">Explore Competitions</Link>
          </div>

          <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <dt className="text-2xl font-semibold text-parchment sm:text-3xl">6</dt>
              <dd className="mt-1 text-xs text-slate-muted sm:text-sm">Steps from discovery to certificate</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold text-parchment sm:text-3xl">9+</dt>
              <dd className="mt-1 text-xs text-slate-muted sm:text-sm">Competitive exams covered</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold text-parchment sm:text-3xl">100%</dt>
              <dd className="mt-1 text-xs text-slate-muted sm:text-sm">Certificates publicly verifiable</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Education categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Platform" title="What VATTAMS ACADEMIA offers" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const Icon = c.icon
            return (
              <Link key={c.title} to={c.to} className="card group flex flex-col gap-4 p-6 transition-all hover:-translate-y-1 hover:border-azure/40 hover:shadow-glow">
                <span className="flex h-11 w-11 items-center justify-center rounded-card bg-azure/10 text-azure-bright transition-colors group-hover:bg-azure/20">
                  <Icon />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-parchment">{c.title}</h3>
                  <p className="mt-2 text-sm text-slate-muted">{c.body}</p>
                </div>
                <span className="mt-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-azure-bright">
                  Explore
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Three-pillar discovery architecture */}
      <section className="border-y border-white/5 bg-gradient-to-b from-navy/50 to-transparent py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="The Academia learning map"
            title="One platform. Three connected learning journeys."
          />
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-muted sm:text-base">
            Start with a course, prepare for a specific exam, or build mastery through a competition. Each pillar has a clear purpose and room to grow into a deeper catalogue.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {ACADEMIA_PILLARS.map((pillar) => (
              <article key={pillar.id} className="card flex min-w-0 flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-[0.22em] text-azure-bright">PILLAR {pillar.number}</span>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,.65)]" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-parchment">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-muted">{pillar.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {pillar.focusAreas.map((area) => (
                    <span key={area} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-parchment/85">{area}</span>
                  ))}
                </div>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-parchment/70">Suggested learning areas</p>
                  <ul className="mt-3 space-y-2">
                    {pillar.suggestedTopics.slice(0, 3).map((topic) => (
                      <li key={topic} className="flex gap-2 text-sm leading-5 text-slate-muted">
                        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to={pillar.route} className="btn-secondary mt-7 w-full sm:w-auto">
                  Explore {pillar.title}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Multilingual learning discovery */}
      <section className="border-b border-white/5 bg-navy/30 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Multilingual learning</p>
            <h2 className="mt-2 font-display text-2xl font-bold">Indian languages and languages from around the world</h2>
            <p className="mt-2 text-sm leading-6 text-slate-muted">Explore the language coverage catalogue, including native names, regional languages, and global languages.</p>
          </div>
          <Link to="/languages" className="btn-secondary inline-flex shrink-0 items-center justify-center">Explore languages →</Link>
        </div>
      </section>

      {/* Featured courses */}
      <section className="border-t border-white/5 bg-navy/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Courses" title="Featured courses" action={{ to: '/courses', label: 'View all courses' }} />
          {courses === null ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-64 animate-pulse" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState message="Featured courses will appear here as soon as they're published." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => <CourseCard key={c.id} course={c} pricingConfig={pricingConfig} />)}
            </div>
          )}
        </div>
      </section>

      {/* Competitive exams */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Competitive Exams" title="Competitive exam preparation" action={{ to: '/competitive-exams', label: 'View all programmes' }} />
          <div className="mt-8 card flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-parchment">TNPSC &middot; UPSC &middot; SSC &middot; Banking &middot; Railway &middot; Police &middot; Defence &middot; UGC NET/SET &middot; TET</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-muted">
                Subject-wise question banks and timed mock tests built to mirror the actual exam
                pattern, so preparation reflects the real thing.
              </p>
            </div>
            <Link to="/competitive-exams" className="btn-primary shrink-0">View programmes</Link>
          </div>
        </div>
      </section>

      {/* Competitions */}
      <section className="border-t border-white/5 bg-navy/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Competitions" title="Timed academic competitions" action={{ to: '/competitions', label: 'View all competitions' }} />
          <div className="mt-8 card flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-parchment">Public leaderboards. Real certificates.</h3>
              <p className="mt-3 max-w-2xl text-sm text-slate-muted">
                Take part in timed competitions and see where you stand — eligible finishers earn a
                certificate carrying a unique, publicly verifiable number.
              </p>
            </div>
            <Link to="/competitions" className="btn-primary shrink-0">View competitions</Link>
          </div>
        </div>
      </section>

      {/* Certification trust */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionHeading eyebrow="Certification" title="Every certificate is instantly verifiable" />
            <p className="mt-3 max-w-xl text-sm text-slate-muted">
              Certificates issued by VATTAMS ACADEMIA carry a unique certificate number. Anyone —
              employers, institutions, or the certificate holder — can confirm it&apos;s genuine in
              seconds, no account required.
            </p>
          </div>
          <Link to="/verify-certificate" className="btn-primary shrink-0">Verify a certificate</Link>
        </div>
      </section>

      {/* Why VATTAMS ACADEMIA */}
      <section className="border-t border-white/5 bg-navy/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Why us" title="Why VATTAMS ACADEMIA" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyVattams.map((item) => (
              <div key={item.title} className="card p-6 transition-colors hover:border-azure/30">
                <h3 className="text-lg font-semibold text-parchment">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Learning experience */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Your learning journey" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {journeySteps.map((s, i) => (
            <div key={s.step} className="relative">
              <div className="card h-full p-5">
                <span className="font-display text-2xl text-azure/50">{s.step}</span>
                <h3 className="mt-2 text-base font-semibold text-parchment">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-muted">{s.body}</p>
              </div>
              {i < journeySteps.length - 1 && (
                <span className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-azure/40 lg:block">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/5 bg-navy-dark py-16">
        <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl sm:text-3xl">Start Your Learning Journey</h2>
          <p className="mt-3 text-slate-muted">
            Join VATTAMS ACADEMIA today and bring your courses, exam prep, and certification together.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/courses" className="btn-primary">Explore Courses</Link>
            <Link to="/register" className="btn-secondary">Create Student Account</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: { to: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link to={action.to} className="text-sm font-medium text-azure-bright hover:text-azure-bright/80">
          {action.label} →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="card mt-8 p-8 text-center text-sm text-slate-muted">{message}</div>
}

// Inline icons — kept local to Home.tsx (no new icon-library dependency)
// and styled to inherit currentColor, matching the Navbar's existing icon
// convention (stroke-based, 2px stroke width).
function IconGraduationCap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4" />
      <path d="M12 13v3M9 20h6M10 20v-3.5M14 20v-3.5" />
    </svg>
  )
}

function IconBriefcase() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </svg>
  )
}

function IconBadgeCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 14.5 4 17.5 3.5 18.5 6.5 21 8l-1 3 1 3-2.5 1.5-1 3-3-.5L12 20l-2.5-2-3 .5-1-3L3 14l1-3-1-3 2.5-1.5 1-3 3 .5L12 2Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
