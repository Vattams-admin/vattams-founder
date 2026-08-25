import { Link } from 'react-router-dom'
import NotificationBell from '@/components/NotificationBell'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function AdminNav({
  active
}: {
  active: 'payments' | 'courses' | 'students' | 'tutors' | 'certificates' | 'notifications'
}) {
  // Notification recipient is resolved here (not passed in as a prop) so
  // every existing call site (AdminPayments, AdminCourses, AdminStudents,
  // AdminTutors, AdminCertificates) keeps working unchanged — none of
  // them need to know about notifications to render this nav.
  const { adminUser, isAdmin } = useAdminAuth()

  const items = [
    { key: 'students', to: '/admin/students', label: 'Students' },
    { key: 'tutors', to: '/admin/tutors', label: 'Tutors' },
    { key: 'courses', to: '/admin/courses', label: 'Courses' },
    { key: 'payments', to: '/admin/payments', label: 'Payments' },
    { key: 'certificates', to: '/admin/certificates', label: 'Certificates' }
  ] as const

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            className={`rounded-card px-3 py-1.5 text-sm font-medium ${
              active === item.key ? 'bg-gold/15 text-gold-bright' : 'text-slate-muted hover:text-parchment'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {isAdmin && <NotificationBell uid={adminUser?.uid ?? null} role="admin" />}
    </nav>
  )
}