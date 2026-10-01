import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import AdminRoute from '@/components/AdminRoute'
import type { Course } from '@/types/database'
import { classifyFirestoreError, type ClassifiedFirestoreError } from '@/lib/firestoreErrors'
import { useSeo } from '@/hooks/useSeo'

type LoadState = 'loading' | 'loaded' | 'error'

export default function AdminCompetitions() {
  useSeo({ title: 'Admin · Competitions', noindex: true })

  const [competitions, setCompetitions] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ClassifiedFirestoreError | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setState('loading')
    setLoadError(null)

    try {
      const snapshot = await getDocs(collection(firestore, 'courses'))

      const rows = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Course)
        .filter((course) => course.is_competition === true)

      setCompetitions(rows)
      setState('loaded')
    } catch (err) {
      setLoadError(classifyFirestoreError(err, 'AdminCompetitions: list competitions'))
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return competitions

    return competitions.filter((competition) =>
      [competition.name, competition.slug, competition.subject]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [competitions, search])

  return (
    <AdminRoute>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <AdminNav active="competitions" />

        <div className="mt-6">
          <p className="text-sm uppercase tracking-[0.3em] text-gold">
            VATTAMS ACADEMIA
          </p>

          <h1 className="mt-3 font-display text-3xl">
            Competition Management
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-muted">
            View and manage competition-specific participants, payments,
            official attempts, results, mock tests, materials and question
            configuration.
          </p>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search competitions…"
          className="input mt-6 max-w-md"
        />

        {state === 'error' && loadError && (
          <div className="mt-8 card border-danger/40 p-8 text-center">
            <p className="font-display text-lg text-danger">
              {loadError.headline}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-muted">
              {loadError.detail}
            </p>
            <p className="mt-2 text-xs text-slate-muted">
              Firestore error code: {loadError.code ?? 'unknown'}
            </p>
            <button onClick={load} className="btn-secondary mt-4">
              Retry
            </button>
          </div>
        )}

        {state === 'loading' && (
          <p className="mt-8 text-sm text-slate-muted">
            Loading competitions…
          </p>
        )}

        {state === 'loaded' && filtered.length === 0 && (
          <p className="mt-8 text-sm text-slate-muted">
            {competitions.length === 0
              ? 'No competitions found.'
              : 'No competitions match your search.'}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {state === 'loaded' &&
            filtered.map((competition) => (
              <div
                key={competition.id}
                className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl">
                      {competition.name}
                    </h2>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        competition.is_published
                          ? 'bg-success/20 text-success'
                          : 'bg-gold/20 text-gold'
                      }`}
                    >
                      {competition.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-muted">
                    /{competition.slug}
                  </p>

                  <p className="mt-2 text-xs text-slate-muted">
                    {competition.min_age != null || competition.max_age != null
                      ? `Age: ${
                          competition.min_age != null
                            ? `${competition.min_age}+`
                            : `up to ${competition.max_age}`
                        }`
                      : 'Age: No restriction configured'}
                  </p>
                </div>

                <Link
                  to={`/admin/competitions/${competition.id}`}
                  className="btn-primary text-xs"
                >
                  Manage Competition
                </Link>
              </div>
            ))}
        </div>
      </div>
    </AdminRoute>
  )
}
