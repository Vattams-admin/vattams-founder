import { Link } from 'react-router-dom'
import AdminPushNotifications from '@/components/admin/AdminPushNotifications'

const adminSections = [
  {
    title: 'Students',
    description: 'View and manage student registrations.',
    path: '/admin/students',
  },
  {
    title: 'Tutors',
    description: 'View and manage tutor registrations.',
    path: '/admin/tutors',
  },
  {
    title: 'Courses',
    description: 'Create, edit and manage academy courses.',
    path: '/admin/courses',
  },
  {
    title: 'Payments',
    description: 'Review course payment transactions.',
    path: '/admin/payments',
  },
  {
    title: 'Live Sessions',
    description: 'View and enter published live classrooms.',
    path: '/admin/live-sessions',
  },
]

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-gold">
          VATTAMS ACADEMIA
        </p>

        <h1 className="mt-3 font-display text-4xl">
          Admin Dashboard
        </h1>

        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Manage students, tutors, courses, payments and live sessions from one place.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {adminSections.map((section) => (
          <Link
            key={section.path}
            to={section.path}
            className="rounded-card border border-white/10 bg-white/[0.04] p-6 transition hover:border-gold/50 hover:bg-white/[0.07]"
          >
            <h2 className="font-display text-2xl text-gold">
              {section.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {section.description}
            </p>

            <span className="mt-6 inline-block text-sm font-semibold text-white">
              Open →
            </span>
          </Link>
        ))}
      </div>

      <AdminPushNotifications />
    </div>
  )
}
