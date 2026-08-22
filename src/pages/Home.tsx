import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublishedCourses } from '@/services/courses'
import { listPublishedExams } from '@/services/exams'
import { listCompetitions } from '@/services/competitions'
import CourseCard from '@/components/CourseCard'
import ExamCard from '@/components/ExamCard'
import CompetitionCard from '@/components/CompetitionCard'
import type { Course, CompetitiveExam, Competition } from '@/types/models'

const offerings = [
  {
    title: 'Courses',
    body: 'Structured academic and professional courses with modules, lessons, and progress tracking.',
    to: '/courses'
  },
  {
    title: 'Competitive Exams',
    body: 'TNPSC, UPSC, SSC, Banking, Railway, Police, Defence, UGC NET/SET and TET preparation.',
    to: '/competitive-exams'
  },
  {
    title: 'Competitions',
    body: 'Timed academic competitions with public leaderboards and eligible-finisher certificates.',
    to: '/competitions'
  },
  {
    title: 'Certifications',
    body: 'Every certificate carries a unique number, instantly verifiable by anyone, anywhere.',
    to: '/verify-certificate'
  }
]

const journeySteps = [
  { step: '01', title: 'Choose your path', body: 'Pick a course, an exam programme, or a competition that matches your goal.' },
  { step: '02', title: 'Enrol & pay securely', body: 'Pay by UPI and submit your reference — enrolment activates once verified.' },
  { step: '03', title: 'Learn & practice', body: 'Work through lessons, question banks, and timed mock tests at your pace.' },
  { step: '04', title: 'Get certified', body: 'Earn a certificate carrying a unique number anyone can verify publicly.' }
]

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [exams, setExams] = useState<CompetitiveExam[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])

  useEffect(() => {
    listPublishedCourses({ featuredOnly: true, pageSize: 3 }).then(setCourses).catch(() => {})
    listPublishedExams().then((rows) => setExams(rows.slice(0, 3))).catch(() => {})
    listCompetitions('registration_open').then((rows) => setCompetitions(rows.slice(0, 3))).catch(() => {})
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(201,162,75,0.14),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="font-display text-xs uppercase tracking-[0.4em] text-gold sm:text-sm">
            Learn &middot; Compete &middot; Certify &middot; Grow
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            Learn. Compete. Certify. Grow.
          </h1>
          <p className="mt-5 max-w-xl text-slate-muted">
            VATTAMS ACADEMIA brings structured courses, competitive exam preparation, timed
            competitions, and verifiable certification together on one academic-standard platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-primary">Explore Courses</Link>
            <Link to="/register" className="btn-secondary">Get Started</Link>
          </div>
        </div>
      </section>

      {/* What we offer */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Platform" title="What VATTAMS ACADEMIA offers" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {offerings.map((o) => (
            <Link key={o.title} to={o.to} className="card group p-6 transition-colors hover:border-gold/40">
              <h3 className="font-display text-lg text-gold-bright">{o.title}</h3>
              <p className="mt-2 text-sm text-slate-muted">{o.body}</p>
              <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wide text-gold group-hover:text-gold-bright">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured courses */}
      <section className="border-t border-white/5 bg-navy/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Courses" title="Featured courses" action={{ to: '/courses', label: 'View all courses' }} />
          {courses.length === 0 ? (
            <EmptyState message="Featured courses will appear here as soon as they're published." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          )}
        </div>
      </section>

      {/* Competitive exams */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Competitive Exams" title="Competitive exam preparation" action={{ to: '/competitive-exams', label: 'View all programmes' }} />
          {exams.length === 0 ? (
            <EmptyState message="Exam programmes will appear here as soon as they're published." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {exams.map((e) => <ExamCard key={e.id} exam={e} />)}
            </div>
          )}
        </div>
      </section>

      {/* Competitions */}
      <section className="border-t border-white/5 bg-navy/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Competitions" title="Open for registration" action={{ to: '/competitions', label: 'View all competitions' }} />
          {competitions.length === 0 ? (
            <EmptyState message="No competitions are open for registration right now — check back soon." />
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {competitions.map((c) => <CompetitionCard key={c.id} competition={c} />)}
            </div>
          )}
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
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { title: 'Transparent pricing', body: 'The fee shown on every course, exam, or competition is the live, admin-configured price — never hardcoded, never stale.' },
              { title: 'Real exam preparation', body: 'Subject-wise question banks and timed mock tests are built to mirror the actual exam pattern.' },
              { title: 'Verifiable certification', body: 'Every certificate carries a unique number anyone can verify publicly, instantly.' }
            ].map((item) => (
              <div key={item.title} className="card p-6">
                <h3 className="font-display text-lg text-gold-bright">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Your learning journey" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {journeySteps.map((s) => (
            <div key={s.step} className="card p-5">
              <span className="font-display text-2xl text-gold/50">{s.step}</span>
              <h3 className="mt-2 font-display text-base">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gold/15 bg-navy-dark py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl sm:text-3xl">Ready to start your journey?</h2>
          <p className="mt-3 text-slate-muted">
            Join VATTAMS ACADEMIA today and bring your courses, exam prep, and certification together.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary">Get Started</Link>
            <Link to="/courses" className="btn-secondary">Explore Courses</Link>
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
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl">{title}</h2>
      </div>
      {action && (
        <Link to={action.to} className="text-sm font-medium text-gold hover:text-gold-bright">
          {action.label} →
        </Link>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="card mt-8 p-8 text-center text-sm text-slate-muted">{message}</div>
}