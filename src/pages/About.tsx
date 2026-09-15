import { Link } from 'react-router-dom'
export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">About</p>
      <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">About VATTAMS ACADEMIA</h1>
      <p className="mt-4 max-w-2xl text-parchment/90">
        VATTAMS ACADEMIA is an academic platform bringing courses, competitive exam preparation,
        competitions, and verifiable certification together under one institution-grade standard.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-slate-muted">
        VATTAMS Academia, formerly known as LITTLE MOUNT ACADEMY.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Section title="Our Vision">
          To be a trusted destination for serious learners — where academic study, exam readiness, and
          competitive achievement are supported by one consistent, credible platform.
        </Section>
        <Section title="Our Mission">
          To make structured, high-quality preparation accessible: clear courses, realistic mock
          assessments, fair competitions, and certificates that can always be verified.
        </Section>
        <Section title="What We Offer">
          Academic courses, competitive exam programmes (TNPSC, UPSC, SSC, Banking, Railway, Police,
          Defence, UGC NET/SET, TET and more), timed competitions with public leaderboards, and
          certification issued and verifiable directly through VATTAMS ACADEMIA.
        </Section>
        <Section title="Learning Philosophy">
          Fundamentals first, then repetition under realistic conditions. Every programme pairs study
          material with timed practice so preparation reflects the actual exam experience.
        </Section>
        <Section title="Certification">
          Every certificate issued by VATTAMS ACADEMIA carries a unique certificate number that can be
          checked instantly on our{' '}
          <Link to="/verify-certificate" className="text-gold hover:text-gold-bright">
            public verification page
          </Link>
          .
        </Section>
        <Section title="Future Vision">
          To keep expanding our exam and course catalogue while holding the same standard: real
          content, honest data, and certification that means something.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg text-gold-bright">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-parchment/90">{children}</p>
    </div>
  )
}