import { Link } from 'react-router-dom'

// There is currently no competitions data source anywhere in this codebase
// — no database table, no Firestore collection, no admin management UI
// (confirmed against supabase/migrations and docs/PHASE-MASTER-MATRIX.md,
// which lists Competitions as "Not started / Not modeled"). Building a
// real listing/detail experience here would mean either inventing
// competition records or inventing a schema — both explicitly out of
// bounds. This page is an honest placeholder so the existing Navbar/Home
// links to /competitions land somewhere real instead of a dead 404,
// with no fabricated dates, prizes, or entries.
export default function Competitions() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-gold/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-10%,rgba(201,162,75,0.16),transparent_50%),radial-gradient(circle_at_85%_0%,rgba(28,58,102,0.5),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 text-center">
          <p className="font-display text-xs uppercase tracking-[0.4em] text-gold sm:text-sm">
            Competitions
          </p>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight sm:text-4xl">
            Knowledge-based competitions, coming soon
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-parchment/90">
            VATTAMS ACADEMIA is building timed academic competitions and challenges for enrolled
            students. This area isn&apos;t live yet — check back soon, or explore courses in the
            meantime.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/courses" className="btn-primary">Explore Courses</Link>
            <Link to="/" className="btn-secondary">Back to Home</Link>
          </div>
        </div>
      </section>
    </div>
  )
}