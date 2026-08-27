import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Material, MaterialType } from '@/types/materials'
import { MATERIAL_TYPES } from '@/types/materials'
import { listPublishedMaterials } from '@/lib/materials'
import MaterialCard from './MaterialCard'
import MaterialViewerModal from './MaterialViewerModal'
import { SearchIcon } from './MaterialIcons'

type Filter = 'all' | MaterialType

// Fetches lazily on mount — this component is only rendered once the
// student switches to the Materials tab in CourseLearn, so the
// `courses/{courseId}/materials` read never happens for students who
// only ever use the lesson player (see "Performance" §18 in the brief:
// lazy-load material lists, avoid unnecessary reads).
export default function LearningMaterialsSection({ courseId }: { courseId: string }) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openMaterial, setOpenMaterial] = useState<Material | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    const { rows, error } = await listPublishedMaterials(courseId)
    if (error) {
      setState('error')
      return
    }
    setMaterials(rows)
    setState('loaded')
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (filter !== 'all' && m.type !== filter) return false
      if (!term) return true
      return [m.title, m.description ?? ''].join(' ').toLowerCase().includes(term)
    })
  }, [materials, filter, search])

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="input pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['all', ...MATERIAL_TYPES.map((t) => t.id)] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f ? 'bg-gold/20 text-gold-bright' : 'text-slate-muted hover:text-parchment'
              }`}
            >
              {f === 'all' ? 'All' : MATERIAL_TYPES.find((t) => t.id === f)?.label}
            </button>
          ))}
        </div>
      </div>

      {state === 'loading' && <p className="mt-6 text-sm text-slate-muted">Loading materials…</p>}

      {state === 'error' && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">Unable to load materials right now.</p>
          <button onClick={load} className="btn-secondary text-xs">
            Retry
          </button>
        </div>
      )}

      {state === 'loaded' && filtered.length === 0 && (
        <p className="mt-6 text-sm text-slate-muted">
          {materials.length === 0 ? 'No learning materials published yet.' : 'No materials match your search.'}
        </p>
      )}

      {state === 'loaded' && filtered.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MaterialCard key={m.id} material={m} onOpen={setOpenMaterial} />
          ))}
        </div>
      )}

      {openMaterial && <MaterialViewerModal material={openMaterial} onClose={() => setOpenMaterial(null)} />}
    </section>
  )
}
