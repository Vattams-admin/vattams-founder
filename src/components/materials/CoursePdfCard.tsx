import { useEffect, useRef, useState } from 'react'
import {
  createMaterial,
  deleteMaterial,
  listAllMaterials,
  newMaterialId,
  updateMaterial,
  uploadMaterialFile,
  type UploadResult
} from '@/lib/materials'
import { validateMaterialFile, formatFileSize } from '@/lib/materialValidation'
import type { Material } from '@/types/materials'
import { PdfIcon, TrashIcon, UploadCloudIcon } from '@/components/materials/MaterialIcons'

// This is a focused, PDF-only view over the SAME courses/{courseId}/materials
// subcollection AdminCourseMaterials.tsx manages in full (all types,
// publish toggle, multiple files). It does not create a separate field,
// collection, or upload path — "the course PDF" here is simply the
// first material of type 'pdf' for this course. If an admin wants more
// than one PDF, or wants to unpublish one without removing it, they
// use "Manage all course materials" (this card links there) — this
// card exists because the brief specifically asked for a single PDF
// control directly on the course edit screen, not because the
// underlying data model is single-PDF.

type LoadState = 'loading' | 'loaded' | 'error'

export default function CoursePdfCard({
  courseId,
  adminUid,
  adminName,
  courseName
}: {
  courseId: string
  adminUid: string
  adminName: string | null
  courseName: string
}) {
  const [state, setState] = useState<LoadState>('loading')
  const [pdf, setPdf] = useState<Material | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setState('loading')
    setError(null)
    const { rows, error: loadError } = await listAllMaterials(courseId)
    if (loadError) {
      setError(loadError)
      setState('error')
      return
    }
    setPdf(rows.find((m) => m.type === 'pdf') ?? null)
    setState('loaded')
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  function pickFile(f: File | null) {
    setError(null)
    if (!f) {
      setFile(f)
      return
    }
    const result = validateMaterialFile('pdf', f)
    if (!result.ok) {
      setError(result.error)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setBusy(true)
    setError(null)
    setUploadPercent(0)

    try {
      const materialId = pdf?.id ?? newMaterialId(courseId)
      const { promise } = uploadMaterialFile(courseId, materialId, file, setUploadPercent)
      const upload: UploadResult = await promise

      const input = {
        title: pdf?.title || `${courseName || 'Course'} — Study Material`,
        description: pdf?.description ?? '',
        type: 'pdf' as const,
        url: '',
        content: '',
        // Published by default: this control has no separate publish
        // toggle (the brief's mockup doesn't include one), and a PDF an
        // admin just attached to a course is expected to reach enrolled
        // students immediately. Use "Manage all course materials" for
        // draft/unpublished control over this same file.
        is_published: true
      }

      const { error: saveError } = pdf
        ? await updateMaterial({
            courseId,
            materialId,
            input,
            upload,
            previousStoragePath: pdf.storage_path
          })
        : await createMaterial({
            courseId,
            materialId,
            input,
            upload,
            uploadedBy: adminUid,
            uploadedByName: adminName
          })

      if (saveError) {
        setError(saveError)
        setBusy(false)
        setUploadPercent(null)
        return
      }

      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadPercent(null)
      setBusy(false)
      await load()
    } catch (err) {
      console.error('[CoursePdfCard] Upload failed:', err)
      setError('Upload failed. Please check your connection and try again.')
      setBusy(false)
      setUploadPercent(null)
    }
  }

  async function handleRemove() {
    if (!pdf) return
    if (!window.confirm(`Remove "${pdf.title}"? Students will no longer be able to open it.`)) return
    setBusy(true)
    const { error: deleteError } = await deleteMaterial(courseId, pdf.id, pdf.storage_path)
    setBusy(false)
    if (deleteError) {
      setError(deleteError)
      return
    }
    setPdf(null)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Course PDF / Study Material</h2>
        <a href={`/admin/courses/${courseId}/materials`} className="text-xs text-gold hover:text-gold-bright">
          Manage all course materials →
        </a>
      </div>

      {state === 'loading' && <p className="mt-3 text-sm text-slate-muted">Loading…</p>}

      {state === 'error' && (
        <div className="mt-3">
          <p className="text-sm text-danger">{error ?? 'Could not load the current PDF.'}</p>
          <button onClick={load} className="btn-secondary mt-2 text-xs">
            Retry
          </button>
        </div>
      )}

      {state === 'loaded' && pdf && !file && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-card bg-gold/15 text-gold">
              <PdfIcon />
            </span>
            <div>
              <p className="font-medium">{pdf.title}</p>
              <p className="text-xs text-slate-muted">{formatFileSize(pdf.file_size)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pdf.url && (
              <a href={pdf.url} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                View
              </a>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="btn-secondary text-xs disabled:opacity-60">
              Replace
            </button>
            <button
              onClick={handleRemove}
              disabled={busy}
              className="flex items-center gap-1 rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
            >
              <TrashIcon /> Remove
            </button>
          </div>
        </div>
      )}

      {state === 'loaded' && !pdf && !file && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 flex w-full cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-white/15 p-6 text-center transition-colors hover:border-gold/50"
        >
          <span className="text-gold">
            <UploadCloudIcon />
          </span>
          <span className="text-sm text-parchment/90">Choose PDF</span>
          <span className="text-xs text-slate-muted">PDF only, up to 25 MB</span>
        </button>
      )}

      {file && (
        <div className="mt-3">
          <p className="text-sm text-parchment/90">
            {file.name} <span className="text-xs text-slate-muted">({formatFileSize(file.size)})</span>
          </p>

          {uploadPercent !== null && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gold transition-all" style={{ width: `${uploadPercent}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-muted">Uploading… {uploadPercent}%</p>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button onClick={handleUpload} disabled={busy} className="btn-primary text-xs disabled:opacity-60">
              {busy ? 'Uploading…' : 'Upload'}
            </button>
            <button
              onClick={() => {
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              disabled={busy}
              className="btn-secondary text-xs disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && state === 'loaded' && <p className="mt-3 text-sm text-danger">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
