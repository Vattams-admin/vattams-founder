import { Link } from 'react-router-dom'

const platformLinks = [
  { to: '/courses', label: 'Courses' },
  { to: '/competitive-exams', label: 'Competitive Exams' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/verify-certificate', label: 'Verify Certificate' }
]

const companyLinks = [
  { to: '/about', label: 'About' },
  { to: '/founder', label: 'Founder' },
  { to: '/contact', label: 'Contact' }
]

const legalLinks = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/refund-policy', label: 'Refund Policy' }
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gold/15 bg-navy-dark">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/branding/logo.png" alt="" className="h-9 w-9 object-contain" />
              <span className="font-display text-base font-semibold text-parchment">
                VATTAMS <span className="text-gold">ACADEMIA</span>
              </span>
            </Link>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-gold-muted">
              Learn. Compete. Certify. Grow.
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-muted">
              Courses, competitive exam preparation, competitions, and verifiable certification —
              built to one academic standard.
            </p>
          </div>

          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} VATTAMS ACADEMIA. All rights reserved.</p>
          <Link to="/verify-certificate" className="hover:text-parchment">Verify a certificate</Link>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm text-slate-muted">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="hover:text-parchment">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}