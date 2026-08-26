import { Link, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/courses', label: 'Courses' },
  { to: '/exams', label: 'Competitive Exams' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/verify', label: 'Verify Certificate' }
]

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-gold/20 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-semibold tracking-wide text-parchment">
            VATTAMS <span className="text-gold">ACADEMIA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-gold-bright' : 'text-slate-muted hover:text-parchment'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-slate-muted hover:text-parchment">
            Log in
          </Link>
          <Link to="/register" className="btn-primary text-sm">
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}
