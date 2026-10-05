import { useSeo } from '@/hooks/useSeo'
import { Link } from 'react-router-dom'

export default function NotFound() {
  useSeo({ title: 'Page Not Found', description: 'The requested VATTAMS ACADEMIA page could not be found.', noindex: true })
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="mt-2 text-slate-muted">That page doesn&apos;t exist, or has moved.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Back to home</Link>
    </div>
  )
}
