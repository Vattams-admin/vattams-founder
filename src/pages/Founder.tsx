import { useSeo } from '@/hooks/useSeo'
export default function Founder() {
  useSeo({ title: 'Founder & CEO — VATTAMS ACADEMIA', description: 'Meet Venkatesan Ponniah, Founder & CEO of VATTAMS ACADEMIA, and learn about the vision behind the education platform.', path: '/founder' })
  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-grid-glow" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="eyebrow">Founder</p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-4xl">
            Building a Better Path to Learning, Competition &amp; Certification
          </h1>

          <div className="mt-10 grid gap-10 sm:grid-cols-[220px_1fr] sm:items-start">
            <div className="relative w-full max-w-[220px]">
              <div className="absolute -inset-1 rounded-card bg-gradient-to-br from-azure/40 to-gold/30 opacity-60 blur-sm" aria-hidden="true" />
              <img
                src="/branding/founder.jpg"
                alt="Venkatesan Ponniah, Founder and CEO of VATTAMS ACADEMIA"
                className="relative w-full max-w-[220px] rounded-card border border-white/10 object-cover shadow-lift"
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Venkatesan Ponniah</h2>
              <p className="mt-1 text-sm font-medium uppercase tracking-wide text-azure-bright">
                Founder &amp; CEO, VATTAMS ACADEMIA
              </p>

              <div className="card mt-6 p-6">
                <p className="font-display text-lg italic leading-relaxed text-parchment/90">
                  &ldquo;I didn&apos;t have the best tools. I had determination. I didn&apos;t have a team. I had a
                  vision. I didn&apos;t have an easy path. I had a purpose.&rdquo;
                </p>
                <p className="mt-4 text-sm text-slate-muted">
                  What started as a single idea has grown into VATTAMS ACADEMIA — a platform built to make
                  serious academic preparation, certification, and competition accessible to every learner.
                  This is not one person&apos;s success story; it&apos;s a movement built together with every
                  student, tutor, and team member who believes education should travel further than
                  circumstance.
                </p>
                <p className="mt-4 text-sm font-semibold text-parchment">— Venkatesan Ponniah</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <InfoCard title="Vision">
            To build a trusted learning platform where academic courses, competitive exam preparation,
            and competitions come together under one standard of quality — accessible to learners
            wherever they are.
          </InfoCard>
          <InfoCard title="Mission">
            To deliver accessible, high-quality education and assessment — supporting students, tutors,
            and institutions with tools that make serious preparation genuinely achievable.
          </InfoCard>
          <InfoCard title="Educational philosophy">
            Concept before speed. Practice before the exam. Every course, mock test, and certification on
            VATTAMS ACADEMIA is built around mastering fundamentals first, then testing them under real
            exam conditions.
          </InfoCard>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-semibold">Why VATTAMS ACADEMIA was created</h2>
          <p className="mt-4 max-w-2xl text-parchment/90">
            VATTAMS ACADEMIA was founded to close the gap between scattered, inconsistent exam-prep
            resources and a single, disciplined platform — one that treats competitive exam coaching,
            academic courses, and competitions with the same rigor, and issues certification that
            actually means something because it can be verified.
          </p>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold text-gold-bright">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-parchment/90">{children}</p>
    </div>
  )
}
