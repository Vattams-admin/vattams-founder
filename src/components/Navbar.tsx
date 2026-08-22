import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/auth'

const navItems = [
  { to: '/courses', label: 'Courses' },
  { to: '/competitive-exams', label: 'Competitive Exams' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/verify-certificate', label: 'Verify Certificate' }
]

export default function Navbar() {
  const { user, profile, isAdmin, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gold/15 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="VATTAMS ACADEMIA home">
          <img src="/branding/logo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="font-display text-base font-semibold leading-none tracking-wide text-parchment sm:text-lg">
            VATTAMS <span className="text-gold">ACADEMIA</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
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

        <div className="hidden items-center gap-3 md:flex">
          {loading ? null : user ? (
            <>
              {isAdmin && (
                <Link to="/admin/dashboard" className="text-sm font-medium text-slate-muted hover:text-parchment">
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="text-sm font-medium text-slate-muted hover:text-parchment">
                {profile?.fullName?.split(' ')[0] ?? 'Dashboard'}
              </Link>
              <button onClick={handleLogout} className="btn-secondary text-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-muted hover:text-parchment">
                Log in
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-card p-2 text-parchment md:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-gold/15 bg-ink px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-card px-2 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-gold/10 text-gold-bright' : 'text-slate-muted hover:bg-navy hover:text-parchment'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm">
                      Admin
                    </Link>
                  )}
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm">
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }}
                    className="btn-primary text-sm"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm">
                    Log in
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}