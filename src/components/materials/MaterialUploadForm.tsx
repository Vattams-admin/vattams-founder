import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import type { Material, MaterialType } from '@/types/materials'
import { MATERIAL_TYPES } from '@/types/materials'
import { validateMaterialFile, formatFileSize, isUploadType } from '@/lib/materialValidation'
import {
  createMaterial,
  newMaterialId,
  updateMaterial,
  uploadMaterialFile,
  type UploadResult,
} from '@/lib/materials'
import { UploadCloudIcon } from './MaterialIcons'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function MaterialUploadForm({
  courseId,
  existingMaterial,
  adminUid,
  adminName,
  onSaved,
  onCancel,
}: {
  courseId: string
  existingMaterial: Material | null
  adminUid: string
  adminName: string | null
  onSaved: () => void
  onCancel: () => void
}) {
  const isEditing = existingMaterial !== null

  const [title, setTitle] = useState(existingMaterial?.title ?? '')
  const [description, setDescription] = useState(existingMaterial?.description ?? '')
  const [type, setType] = useState<MaterialType>(existingMaterial?.type ?? 'pdf')
  const [url, setUrl] = useState(existingMaterial?.type === 'link' ? existingMaterial.url ?? '' : '')
  const [content, setContent] = useState(existingMaterial?.content ?? '')
  const [isPublished, setIsPublished] = useState(existingMaterial?.is_published ?? false)

  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelUploadRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadKind = isUploadType(type) ? type : null

  function pickFile(f: File | null) {
    setError(null)
    if (!f || !uploadKind) {
      setFile(f)
      return
    }
    const result = validateMaterialFile(uploadKind, f)
    if (!result.ok) {
      setError(result.error)
      setFile(null)
      return
    }
    setFile(f)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0] ?? null)
  }

  const canceledRef = useRef(false)

  function cancelUploadIfAny() {
    canceledRef.current = true
    cancelUploadRef.current?.()
    cancelUploadRef.current = null
    setUploadPercent(null)
    setSaving(false)
    setError('Upload canceled.')
  }

  async function handleSubmit() {
    setError(null)
    canceledRef.current = false

    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    if (type === 'link' && !url.trim()) {
      setError('Add the external URL.')
      return
    }
    if (type === 'notes' && !content.trim()) {
      setError('Add some content for this note.')
      return
    }
    if (uploadKind && !isEditing && !file) {
      setError(`Select a ${uploadKind} file to upload.`)
      return
    }
    if (uploadKind && file) {
      const result = validateMaterialFile(uploadKind, file)
      if (!result.ok) {
        setError(result.error)
        return
      }
    }

    setSaving(true)

    try {
      let upload: UploadResult | null = null
      const materialId = existingMaterial?.id ?? newMaterialId(courseId)

      if (uploadKind && file) {
        setUploadPercent(0)
        const { promise, cancel } = uploadMaterialFile(courseId, materialId, file, setUploadPercent)
        cancelUploadRef.current = cancel
        upload = await promise
        cancelUploadRef.current = null
        setUploadPercent(100)
      }

      const input = {
        title,
        description,
        type,
        url,
        content,
        is_published: isPublished,
      }

      const { error: saveError } = isEditing
        ? await updateMaterial({
            courseId,
            materialId,
            input,
            upload,
            previousStoragePath: existingMaterial?.storage_path ?? null,
          })
        : await createMaterial({
            courseId,
            materialId,
            input,
            upload,
            uploadedBy: adminUid,
            uploadedByName: adminName,
          })

      if (saveError) {
        setError(saveError)
        setSaving(false)
        setUploadPercent(null)
        return
      }

      onSaved()
    } catch (err) {
      if (canceledRef.current) {
        // cancelUploadIfAny() already reset saving/progress and set the
        // "Upload canceled." message — don't clobber it with the
        // generic failure message below.
        return
      }
      console.error('Failed to save material:', err)
      // ROOT-CAUSE FIX: this used to always show a generic "Unable to
      // save right now" message no matter what actually failed —
      // hiding whether the problem was Supabase Storage rejecting the
      // upload, a network/CORS failure, an expired Firebase session,
      // or something else. uploadMaterialFile()/uploadCourseMaterial()
      // (src/lib/supabaseStorage.ts) throw a specific, already-
      // user-safe Error for every failure mode (see its callers) —
      // none of them include tokens, keys, or other secrets, so
      // surfacing `err.message` here is safe and is what actually
      // lets an admin (or whoever's debugging with them) tell "Admin
      // access required" apart from "Upload authorization token was
      // not returned" apart from a plain network failure, instead of
      // every failure looking identical.
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to save right now. Please check your connection and try again.'
      setError(message)
      setSaving(false)
      setUploadPercent(null)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">{isEditing ? 'Edit material' : 'New material'}</h2>

      <div className="mt-4 space-y-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Week 3 — Practice worksheet" />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input"
            placeholder="Optional — shown to students in the materials list"
          />
        </Field>

        <Field label="Type">
          <select
            value={type}
            disabled={isEditing}
            onChange={(e) => setType(e.target.value as MaterialType)}
            className="input disabled:opacity-60"
          >
            {MATERIAL_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {isEditing && <p className="mt-1 text-xs text-slate-muted">Type can&apos;t be changed after creation — delete and re-add instead.</p>}
        </Field>

        {type === 'link' && (
          <Field label="External URL">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input"
              placeholder="https://…"
              type="url"
            />
          </Field>
        )}

        {type === 'notes' && (
          <Field label="Note content">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="input"
              placeholder="Plain text — paragraph breaks are preserved for students."
            />
          </Field>
        )}

        {uploadKind && (
          <Field label={isEditing ? 'Replace file (optional)' : 'File'}>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? 'border-gold bg-gold/5' : 'border-white/15 hover:border-gold/50'
              }`}
            >
              <span className="text-gold">
                <UploadCloudIcon />
              </span>
              <p className="text-sm text-parchment/90">
                {file ? file.name : 'Drag & drop, or click to choose a file'}
              </p>
              {file && <p className="text-xs text-slate-muted">{formatFileSize(file.size)}</p>}
              {!file && isEditing && existingMaterial?.file_size && (
                <p className="text-xs text-slate-muted">
                  Current: {formatFileSize(existingMaterial.file_size)}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={
                  uploadKind === 'pdf' ? 'application/pdf' : uploadKind === 'image' ? 'image/*' : 'video/*'
                }
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {uploadPercent !== null && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gold transition-all" style={{ width: `${uploadPercent}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-muted">Uploading… {uploadPercent}%</p>
                  {uploadPercent < 100 && (
                    <button type="button" onClick={cancelUploadIfAny} className="text-xs text-danger">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink accent-gold"
          />
          Published (visible to enrolled students)
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create material'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary text-sm disabled:opacity-60">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
