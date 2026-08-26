import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      {/* Hero — the crest's own motto is the thesis, not a generic stat block */}
      <section className="relative overflow-hidden border-b border-gold/20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="font-display text-sm uppercase tracking-[0.4em] text-gold">
            Learn &middot; Compete &middot; Certify &middot; Grow
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            One academy for courses, competitive exams, competitions and certification.
          </h1>
          <p className="mt-5 max-w-xl text-slate-muted">
            VATTAMS ACADEMIA brings structured courses, TNPSC/UPSC/SSC/Banking exam
            preparation, timed competitions and verifiable certificates into a single,
            fee-transparent platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/courses" className="btn-primary">Explore courses</Link>
            <Link to="/exams" className="btn-secondary">Explore competitive exams</Link>
            <Link to="/competitions" className="btn-secondary">Join a competition</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl">Why students choose VATTAMS ACADEMIA</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            { title: 'Transparent pricing', body: 'The fee shown on every course or exam is always the live, admin-configured price — never hardcoded, never stale.' },
            { title: 'Real exam preparation', body: 'Subject-wise question banks, timed mock tests and negative marking mirror the actual exam pattern.' },
            { title: 'Verifiable certification', body: 'Every certificate carries a unique code and QR — anyone can verify it publicly, instantly.' }
          ].map((item) => (
            <div key={item.title} className="card p-6">
              <h3 className="font-display text-lg text-gold-bright">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
