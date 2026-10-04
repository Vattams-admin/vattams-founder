import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useUserRole } from '@/hooks/useUserRole'
import NotificationBell from '@/components/NotificationBell'
const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/competitive-exams', label: 'Competitive Exams' },
  { to: '/competitions', label: 'Competitions' },
  { to: '/verify-certificate', label: 'Certifications' },
  { to: '/about', label: 'About' },
  { to: '/founder', label: 'Founder' }
]
export default function Navbar() {
  const { user, loading } = useAuth()
  const { role, loading: roleLoading } = useUserRole()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  // ROLE-AWARE DASHBOARD LINK — this Navbar is shared by every signed-in
  // visitor (see useUserRole.ts), so the persistent "Dashboard" link must
  // not hardcode the student route. A Tutor clicking this from anywhere
  // in the app (including right after leaving a live classroom) needs to
  // land on their own dashboard, never the Student "Your learning" page.
  // While the role lookup is unresolved, do not guess "student" — guessing
  // would silently reroute a tutor to the wrong dashboard.
  const dashboardPath =
    role === 'tutor' ? '/tutor/dashboard' :
    role === 'student' ? '/dashboard' :
    null
  async function handleLogout() {
    await signOut(firebaseAuth)
    navigate('/')
  }
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="VATTAMS ACADEMIA home"
        >
          <img src="/branding/logo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="font-display text-base font-semibold leading-none tracking-wide text-parchment sm:text-lg">
            VATTAMS <span className="text-gold">ACADEMIA</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-5 xl:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap text-sm font-medium transition-colors ${
                  isActive ? 'text-azure-bright' : 'text-slate-muted hover:text-parchment'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 xl:flex">
          {loading ? null : user ? (
            <>
              <NotificationBell uid={user.id} role={role} />
              {roleLoading || !dashboardPath ? (
                <span className="text-sm font-medium text-slate-muted" aria-live="polite">
                  Loading…
                </span>
              ) : (
                <Link to={dashboardPath} className="text-sm font-medium text-slate-muted hover:text-parchment">
                  {user.displayName?.split(' ')[0] ?? 'Dashboard'}
                </Link>
              )}
              <button onClick={handleLogout} className="btn-secondary text-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-slate-muted hover:text-parchment">
                Log in
              </Link>
              <Link to="/tutor/register" className="text-sm font-medium text-slate-muted hover:text-parchment">
                Become a Tutor
              </Link>
              <Link to="/student/register" className="btn-primary text-sm">
                Student Registration
              </Link>
              <Link to="/admin" className="text-sm font-medium text-slate-muted hover:text-parchment">
                Admin Login
              </Link>
            </>
          )}
        </div>
        <button
          className="rounded-card p-2 text-parchment xl:hidden"
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
        <div className="border-t border-white/5 bg-ink px-4 pb-4 xl:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-card px-2 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-azure/10 text-azure-bright' : 'text-slate-muted hover:bg-navy hover:text-parchment'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {user ? (
                <>
                  <div className="flex items-center justify-between">
                    <Link
                      to="/notifications"
                      onClick={() => setMenuOpen(false)}
                      className="text-sm font-medium text-slate-muted hover:text-parchment"
                    >
                      Notifications
                    </Link>
                    <NotificationBell uid={user.id} role={role} />
                  </div>
                  {roleLoading || !dashboardPath ? (
                    <div className="btn-secondary text-sm text-center" aria-live="polite">
                      Loading…
                    </div>
                  ) : (
                    <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className="btn-secondary text-sm">
                      Dashboard
                    </Link>
                  )}
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
                  <Link to="/student/register" onClick={() => setMenuOpen(false)} className="btn-primary text-sm">
                    Student Registration
                  </Link>
                  <Link to="/tutor/register" onClick={() => setMenuOpen(false)} className="btn-secondary text-sm">
                    Become a Tutor
                  </Link>
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="text-center text-sm font-medium text-slate-muted hover:text-parchment"
                  >
                    Admin Login
                  </Link>
                </>
              )}
            </div>
            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-muted/70">
              VATTAMS Academia, formerly known as LITTLE MOUNT ACADEMY.
            </p>
          </nav>
        </div>
      )}
    </header>
