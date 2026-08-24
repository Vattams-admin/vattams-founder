import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'

const emptyForm = {
  name: '', slug: '', short_description: '', description: '',
  level: 'beginner' as NonNullable<Course['level']>,
  instructor_name: '', duration_text: '', cover_image_url: '',
  base_fee: 0, discount_amount: 0, is_free: false
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function AdminCourseForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setLoading(true)
    setLoadError(false)

    // `id` is the Firestore document id — same convention as Payment.tsx
    // and every other page that reads a single course by id.
    getDoc(doc(firestore, 'courses', id as string))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setLoadError(true)
          setLoading(false)
          return
        }
        const c = { id: snap.id, ...snap.data() } as Course
        setForm({
          name: c.name, slug: c.slug, short_description: c.short_description ?? '',
          description: c.description ?? '', level: c.level ?? 'beginner',
          instructor_name: c.instructor_name ?? '', duration_text: c.duration_text ?? '',
          cover_image_url: c.cover_image_url ?? '', base_fee: c.base_fee,
          discount_amount: c.discount_amount, is_free: c.is_free
        })
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load course for editing:', err)
        setLoadError(true)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [id, isNew, retryToken])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(publish?: boolean) {
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      ...(publish !== undefined ? { is_published: publish } : {})
    }

    try {
      if (isNew) {
        await addDoc(collection(firestore, 'courses'), {
          ...payload,
          category_id: null,
          preview_video_url: null,
          is_published: publish ?? false,
          is_featured: false,
          created_at: new Date().toISOString()
        })
      } else {
        await updateDoc(doc(firestore, 'courses', id as string), payload)
      }
      navigate('/admin/courses')
    } catch (err) {
      console.error('Unexpected error saving course:', err)
      setError('Unable to save right now. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-16 text-slate-muted">Loading…</div>

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg text-danger">Unable to load this course</p>
        <p className="mt-2 text-sm text-slate-muted">
          Please check your internet connection and try again.
        </p>
        <button onClick={() => setRetryToken((t) => t + 1)} className="btn-primary mt-6">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">{isNew ? 'New course' : 'Edit course'}</h1>

      <div className="mt-6 space-y-4">
        <Field label="Course name">
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input" />
        </Field>
        <Field label="Slug (URL)">
          <input value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder={slugify(form.name) || 'auto-generated'} className="input" />
        </Field>
        <Field label="Short description">
          <input value={form.short_description} onChange={(e) => update('short_description', e.target.value)} className="input" />
        </Field>
        <Field label="Full description">
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Level">
            <select value={form.level} onChange={(e) => update('level', e.target.value as NonNullable<Course['level']>)} className="input">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="professional">Professional</option>
            </select>
          </Field>
          <Field label="Duration">
            <input value={form.duration_text} onChange={(e) => update('duration_text', e.target.value)} placeholder="e.g. 6 weeks" className="input" />
          </Field>
        </div>
        <Field label="Instructor name">
          <input value={form.instructor_name} onChange={(e) => update('instructor_name', e.target.value)} className="input" />
        </Field>
        <Field label="Cover image URL">
          <input value={form.cover_image_url} onChange={(e) => update('cover_image_url', e.target.value)} className="input" />
        </Field>

        <div className="card p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_free} onChange={(e) => update('is_free', e.target.checked)} />
            This is a free course
          </label>
          {!form.is_free && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Base fee (₹)">
                <input type="number" min={0} value={form.base_fee} onChange={(e) => update('base_fee', Number(e.target.value))} className="input" />
              </Field>
              <Field label="Discount (₹)">
                <input type="number" min={0} value={form.discount_amount} onChange={(e) => update('discount_amount', Number(e.target.value))} className="input" />
              </Field>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-muted">
            This is the single source of truth for price. Changing it here updates what every
            student sees immediately — nothing is hardcoded on the payment page.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={() => handleSave()} disabled={saving} className="btn-secondary disabled:opacity-60">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : 'Save & publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}