import { Link } from 'react-router-dom'

export default function AdminNav({ active }: { active: 'payments' | 'courses' | 'students' | 'tutors' }) {
  const items = [
    { key: 'students', to: '/admin/students', label: 'Students' },
    { key: 'tutors', to: '/admin/tutors', label: 'Tutors' },
    { key: 'courses', to: '/admin/courses', label: 'Courses' },
    { key: 'payments', to: '/admin/payments', label: 'Payments' }
  ] as const

  return (
    <nav className="flex gap-2 border-b border-white/10 pb-3">
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
    </nav>
  )
}
