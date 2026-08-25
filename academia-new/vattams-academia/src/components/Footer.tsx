import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-gold/20 bg-navy-dark">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-gold">
          Learn &middot; Compete &middot; Certify &middot; Grow
        </p>
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm text-slate-muted sm:grid-cols-4">
          <div>
            <h3 className="mb-2 font-semibold text-parchment">Platform</h3>
            <ul className="space-y-1">
              <li><Link to="/courses" className="hover:text-parchment">Courses</Link></li>
              <li><Link to="/exams" className="hover:text-parchment">Competitive exams</Link></li>
              <li><Link to="/competitions" className="hover:text-parchment">Competitions</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-parchment">Company</h3>
            <ul className="space-y-1">
              <li><Link to="/about" className="hover:text-parchment">About</Link></li>
              <li><Link to="/contact" className="hover:text-parchment">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-parchment">Legal</h3>
            <ul className="space-y-1">
              <li><Link to="/privacy" className="hover:text-parchment">Privacy policy</Link></li>
              <li><Link to="/terms" className="hover:text-parchment">Terms</Link></li>
              <li><Link to="/refund" className="hover:text-parchment">Refund policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-parchment">Certificates</h3>
            <ul className="space-y-1">
              <li><Link to="/verify" className="hover:text-parchment">Verify a certificate</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-xs text-slate-muted">
          &copy; {new Date().getFullYear()} VATTAMS ACADEMIA. Certificates are issued solely by VATTAMS ACADEMIA.
        </p>
      </div>
    </footer>
  )
}
