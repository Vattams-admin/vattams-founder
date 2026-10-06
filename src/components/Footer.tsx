import { Link } from 'react-router-dom'

const platformLinks = [
  { to: '/courses', label: 'Courses' },
  { to: '/competitive-exams', label: 'Competitive Exams' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/verify-certificate', label: 'Verify Certificate' },
]

const companyLinks = [
  { to: '/about', label: 'About Academia' },
  { to: '/founder', label: 'Founder' },
  { to: '/contact', label: 'Contact' },
]

const legalLinks = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/refund-policy', label: 'Refund Policy' },
  { to: '/udyam-registration', label: 'Udyam Registration' },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-white/10 bg-[#030914]">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 lg:px-10">
        <div className="mb-10 rounded-3xl border border-white/10 bg-gradient-to-r from-[#0B1426] via-[#0A1932] to-[#07101F] p-6 shadow-[0_24px_80px_rgba(0,0,0,.24)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#67E8F9]">VATTAMS Ecosystem</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Learn better. Live easier. Connect smarter.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explore the wider VATTAMS technology ecosystem across education, home services, and intelligent communication.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="https://academia.vattams.net" className="rounded-full border border-[#3B82F6]/40 bg-[#3B82F6]/10 px-4 py-2 text-sm font-semibold text-[#93C5FD]">Academia</a>
              <a href="https://vattams.net" className="rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2 text-sm font-semibold text-[#FDBA74]">Home Services</a>
              <a href="https://callpilot.vattams.net" className="rounded-full border border-[#22C55E]/40 bg-[#22C55E]/10 px-4 py-2 text-sm font-semibold text-[#86EFAC]">CallPilot</a>
            </div>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/branding/logo-header.png" alt="VATTAMS Academia" className="h-11 w-auto object-contain" />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">An international-standard learning platform for courses, competitive exams, competitions, study materials, mock tests, and certifications.</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[.2em] text-[#60A5FA]">Learn Better. Achieve More.</p>
          </div>
          <FooterColumn title="Academia" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} VATTAMS Global Technologies Private Limited. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[.22em] text-[#60A5FA]">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
        {links.map((l) => (
          <li key={l.to}><Link to={l.to} className="transition-colors hover:text-white">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  )
}
