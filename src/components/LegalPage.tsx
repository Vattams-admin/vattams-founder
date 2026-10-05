import { useSeo } from '@/hooks/useSeo'

export default function LegalPage({
  title,
  eyebrow = 'Legal',
  intro,
  noindex = false,
  children
}: {
  title: string
  eyebrow?: string
  intro?: React.ReactNode
  noindex?: boolean
  children: React.ReactNode
}) {
  useSeo({
    title,
    description: intro ? `${title} — VATTAMS ACADEMIA` : `${title} for VATTAMS ACADEMIA students, tutors and platform users.`,
    path: window.location.pathname,
    noindex,
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl">{title}</h1>
      {intro && <p className="mt-4 text-sm leading-relaxed text-parchment/90">{intro}</p>}
      <div className="mt-6 space-y-8 text-sm leading-relaxed text-parchment/90">
        {children}
      </div>
    </div>
  )
}

// Shared section block used by the policy pages (Tutor Verification
// Policy, Student/Parent Guidelines, Tutor Code of Conduct, Payment &
// Enrollment Terms, Certificate/Competition Terms) so each reads as one
// consistent document instead of five differently-styled pages.
export function PolicySection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-gold-bright">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}