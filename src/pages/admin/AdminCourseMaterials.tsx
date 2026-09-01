import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { listAllMaterials, deleteMaterial, togglePublishMaterial } from '@/lib/materials'
import type { Material } from '@/types/materials'
import { getMaterialTypeLabel } from '@/types/materials'
import { formatFileSize } from '@/lib/materialValidation'
import { MaterialTypeIcon, TrashIcon } from '@/components/materials/MaterialIcons'
import MaterialUploadForm from '@/components/materials/MaterialUploadForm'

export default function AdminCourseMaterials() {
  const { id: courseId } = useParams<{ id: string }>()
  const { adminUser, adminProfile } = useAdminAuth()

  const [courseName, setCourseName] = useState<string>('')
  const [materials, setMaterials] = useState<Material[]>([])
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'none' | 'new' | Material>('none')

  const load = useCallback(async () => {
    if (!courseId) return
    setState('loading')
    try {
      const courseSnap = await getDoc(doc(firestore, 'courses', courseId))
      setCourseName(courseSnap.exists() ? ((courseSnap.data().name as string) ?? '') : '')
    } catch {
      // Non-fatal — the materials list below still works without the
      // course name; just falls back to showing the id in the heading.
    }

    const { rows, error: loadError } = await listAllMaterials(courseId)
    if (loadError) {
      setError(loadError)
      setState('error')
      return
    }
    setMaterials(rows)
    setState('loaded')
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  async function handleTogglePublish(material: Material) {
    if (!courseId) return
    setBusyId(material.id)
    const { error: err } = await togglePublishMaterial(courseId, material.id, !material.is_published)
    if (err) {
      setError(err)
    } else {
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, is_published: !m.is_published } : m))
      )
    }
    setBusyId(null)
  }

  async function handleDelete(material: Material) {
    if (!courseId) return
    if (!window.confirm(`Delete "${material.title}"? This cannot be undone.`)) return
    setBusyId(material.id)
    const { error: err, deleted } = await deleteMaterial(courseId, material.id, material.storage_path)
    // `deleted` tells us whether the Firestore record is actually gone —
    // `err` alone is ambiguous, since it's also set for the "deleted,
    // but storage cleanup failed" case (see deleteMaterial in
    // lib/materials.ts), where the row still needs to disappear.
    if (deleted) {
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
    }
    if (err) {
      setError(err)
    }
    setBusyId(null)
  }

  if (!courseId) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link to="/admin/courses" className="text-sm text-slate-muted hover:text-parchment">
        ← Back to courses
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Learning Materials</h1>
          <p className="mt-1 text-sm text-slate-muted">{courseName || courseId}</p>
        </div>
        {formMode === 'none' && (
          <button onClick={() => setFormMode('new')} className="btn-primary text-sm">
            New material
          </button>
        )}
      </div>

      {error && state !== 'error' && <p className="mt-4 text-sm text-danger">{error}</p>}

      {formMode !== 'none' && (
        <div className="mt-6">
          <MaterialUploadForm
            courseId={courseId}
            existingMaterial={formMode === 'new' ? null : formMode}
            adminUid={adminUser?.uid ?? ''}
            adminName={adminProfile?.full_name ?? null}
            onCancel={() => setFormMode('none')}
            onSaved={() => {
              setFormMode('none')
              load()
            }}
          />
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'error' && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">Couldn&apos;t load materials</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-muted">
            {error ?? 'Please check your internet connection and try again.'}
          </p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {state === 'loaded' && materials.length === 0 && formMode === 'none' && (
        <p className="mt-8 text-sm text-slate-muted">No materials yet — add the first one above.</p>
      )}

      {state === 'loaded' && materials.length > 0 && (
        <div className="mt-6 space-y-3">
          {materials.map((material) => (
            <div key={material.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-card bg-gold/15 text-gold">
                  <MaterialTypeIcon type={material.type} />
                </span>
                <div>
                  <p className="font-medium">{material.title}</p>
                  <p className="text-slate-muted">
                    {getMaterialTypeLabel(material.type)}
                    {material.file_size ? ` · ${formatFileSize(material.file_size)}` : ''}
                    {material.uploaded_by_name ? ` · by ${material.uploaded_by_name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    material.is_published ? 'bg-success/20 text-success' : 'bg-gold/20 text-gold'
                  }`}
                >
                  {material.is_published ? 'Published' : 'Draft'}
                </span>
                <button
                  onClick={() => handleTogglePublish(material)}
                  disabled={busyId === material.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {material.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => setFormMode(material)}
                  disabled={busyId === material.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(material)}
                  disabled={busyId === material.id}
                  className="flex items-center gap-1 rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
