import { Link } from 'react-router-dom'

export default function AdminNav({ active }: { active: 'payments' | 'courses' }) {
  const items = [
    { key: 'payments', to: '/admin/payments', label: 'Payments' },
    { key: 'courses', to: '/admin/courses', label: 'Courses' }
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
