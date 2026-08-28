import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Course } from '@/types/database'
import { CATALOG_CATEGORIES, type CatalogCategoryId } from '@/lib/catalog'
import { classifyFirestoreError, type ClassifiedFirestoreError } from '@/lib/firestoreErrors'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import CoursePdfCard from '@/components/materials/CoursePdfCard'

// Level intentionally includes '' ("Not set") as a real, distinct form
// value — separate from any of the four actual levels. The bug this
// guards against: the previous version of this form defaulted every
// course (including ones loaded with level: null from the database) to
// 'beginner' in local state, then saved that default back on every
// edit — silently fabricating a level for courses the admin never
// touched. '' round-trips to/from Firestore `null` and nothing else.
type LevelValue = NonNullable<Course['level']> | ''

interface FormState {
  name: string
  slug: string
  short_description: string
  description: string
  level: LevelValue
  instructor_name: string
  duration_text: string
  cover_image_url: string
  preview_video_url: string
  base_fee: number
  discount_amount: number
  is_free: boolean
  is_published: boolean
  is_featured: boolean
  category_id: CatalogCategoryId | ''
  is_competition: boolean
}

const emptyForm: FormState = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  level: '',
  instructor_name: '',
  duration_text: '',
  cover_image_url: '',
  preview_video_url: '',
  base_fee: 0,
  discount_amount: 0,
  is_free: false,
  is_published: false,
  is_featured: false,
  category_id: '',
  is_competition: false
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isPlausibleUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// Every optional text field round-trips through this: '' in the form
// becomes null in Firestore, never a stored empty string, and never
// left as whatever it happened to be — "Removing a value should
// correctly save NULL" is a save-time normalization, not something
// each field has to remember to do individually.
function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export default function AdminCourseForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const { adminUser, adminProfile } = useAdminAuth()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [originalSlug, setOriginalSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<ClassifiedFirestoreError | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ClassifiedFirestoreError | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [saved, setSaved] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    getDoc(doc(firestore, 'courses', id as string))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setLoadError({
            code: 'not-found',
            headline: 'Course not found',
            detail: 'This course may have been deleted.',
            retryable: false
          })
          setLoading(false)
          return
        }
        const c = { id: snap.id, ...snap.data() } as Course
        setForm({
          name: c.name,
          slug: c.slug,
          short_description: c.short_description ?? '',
          description: c.description ?? '',
          level: c.level ?? '',
          instructor_name: c.instructor_name ?? '',
          duration_text: c.duration_text ?? '',
          cover_image_url: c.cover_image_url ?? '',
          preview_video_url: c.preview_video_url ?? '',
          base_fee: c.base_fee,
          discount_amount: c.discount_amount,
          is_free: c.is_free,
          is_published: c.is_published,
          is_featured: c.is_featured,
          category_id: (c.category_id as CatalogCategoryId | null) ?? '',
          is_competition: c.is_competition ?? false
        })
        setOriginalSlug(c.slug)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(classifyFirestoreError(err, 'AdminCourseForm: load course'))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, isNew, retryToken])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  // Returns an empty object when valid. Every check here maps to a
  // requirement from the brief: required/trimmed name, URL-safe unique
  // slug, non-negative numeric pricing, discount never exceeding the
  // base fee, and well-formed optional URLs.
  function validate(): Partial<Record<keyof FormState, string>> {
    const errors: Partial<Record<keyof FormState, string>> = {}

    const trimmedName = form.name.trim()
    if (!trimmedName) errors.name = 'Course name is required.'
    else if (trimmedName.length < 3) errors.name = 'Course name must be at least 3 characters.'

    const slugCandidate = (form.slug.trim() || slugify(form.name)).toLowerCase()
    if (!slugCandidate) errors.slug = 'Slug is required.'
    else if (!SLUG_PATTERN.test(slugCandidate)) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens (e.g. "spoken-english").'
    }

    if (!form.is_free) {
      if (!Number.isFinite(form.base_fee) || form.base_fee < 0) {
        errors.base_fee = 'Base fee must be a valid amount of 0 or more.'
      }
      if (!Number.isFinite(form.discount_amount) || form.discount_amount < 0) {
        errors.discount_amount = 'Discount must be a valid amount of 0 or more.'
      }
      if (
        Number.isFinite(form.base_fee) &&
        Number.isFinite(form.discount_amount) &&
        form.discount_amount > form.base_fee
      ) {
        errors.discount_amount = 'Discount cannot exceed the base fee.'
      }
    }

    if (form.cover_image_url.trim() && !isPlausibleUrl(form.cover_image_url.trim())) {
      errors.cover_image_url = 'Enter a valid http(s) URL, or leave this blank.'
    }
    if (form.preview_video_url.trim() && !isPlausibleUrl(form.preview_video_url.trim())) {
      errors.preview_video_url = 'Enter a valid http(s) URL, or leave this blank.'
    }

    return errors
  }

  async function isSlugTaken(slug: string): Promise<boolean> {
    const snap = await getDocs(query(collection(firestore, 'courses'), where('slug', '==', slug)))
    if (snap.empty) return false
    if (isNew) return true
    // Editing: the slug is only "taken" if it belongs to a DIFFERENT
    // course. Finding only this course's own existing doc is fine.
    return snap.docs.some((d) => d.id !== id)
  }

  async function handleSave(publish?: boolean) {
    setSaveError(null)
    setSaved(false)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})

    const slug = (form.slug.trim() || slugify(form.name)).toLowerCase()
    setSaving(true)

    try {
      if (await isSlugTaken(slug)) {
        setFieldErrors({ slug: `The slug "${slug}" is already used by another course. Choose a different one.` })
        setSaving(false)
        return
      }

      // A free course must never carry a stale nonzero fee — pricing
      // inputs are hidden (not cleared) when "This is a free course" is
      // checked, and Payment.tsx / firestore.rules both derive the
      // actual charge from these fields, so a leftover base_fee here
      // would make a course that displays as free actually chargeable.
      const normalizedPricing = form.is_free ? { base_fee: 0, discount_amount: 0 } : { base_fee: form.base_fee, discount_amount: form.discount_amount }

      const basePayload = {
        name: form.name.trim(),
        slug,
        short_description: normalizeOptionalText(form.short_description),
        description: normalizeOptionalText(form.description),
        level: form.level || null,
        instructor_name: normalizeOptionalText(form.instructor_name),
        duration_text: normalizeOptionalText(form.duration_text),
        cover_image_url: normalizeOptionalText(form.cover_image_url),
        preview_video_url: normalizeOptionalText(form.preview_video_url),
        ...normalizedPricing,
        is_free: form.is_free,
        category_id: form.category_id || null,
        is_competition: form.is_competition,
        is_featured: form.is_featured
      }

      if (isNew) {
        await addDoc(collection(firestore, 'courses'), {
          ...basePayload,
          is_published: publish ?? false,
          created_at: serverTimestamp()
        })
      } else {
        await updateDoc(doc(firestore, 'courses', id as string), {
          ...basePayload,
          ...(publish !== undefined ? { is_published: publish } : {})
        })
      }

      if (isNew) {
        navigate('/admin/courses')
      } else {
        setOriginalSlug(slug)
        setSaved(true)
      }
    } catch (err) {
      setSaveError(classifyFirestoreError(err, 'AdminCourseForm: save course'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-16 text-slate-muted">Loading…</div>

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-display text-lg text-danger">{loadError.headline}</p>
        <p className="mt-2 text-sm text-slate-muted">{loadError.detail}</p>
        {loadError.retryable && (
          <button onClick={() => setRetryToken((t) => t + 1)} className="btn-primary mt-6">
            Retry
          </button>
        )}
      </div>
    )
  }

  const slugChanged = !isNew && originalSlug !== null && (form.slug.trim() || slugify(form.name)).toLowerCase() !== originalSlug

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl">{isNew ? 'New course' : 'Edit course'}</h1>

      <div className="mt-6 space-y-4">
        <Field label="Course name" error={fieldErrors.name}>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input" />
        </Field>
        <Field label="Slug (URL)" error={fieldErrors.slug}>
          <input
            value={form.slug}
            onChange={(e) => update('slug', e.target.value)}
            placeholder={slugify(form.name) || 'auto-generated'}
            className="input"
          />
          {slugChanged && (
            <p className="mt-1 text-xs text-gold">
              Changing the slug changes this course&apos;s public URL — any existing links to
              /courses/{originalSlug} will stop working. Only change this if you&apos;re sure.
            </p>
          )}
        </Field>
        <Field label="Short description">
          <input
            value={form.short_description}
            onChange={(e) => update('short_description', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Full description">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Level">
            <select value={form.level} onChange={(e) => update('level', e.target.value as LevelValue)} className="input">
              <option value="">Not set</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="professional">Professional</option>
            </select>
          </Field>
          <Field label="Duration">
            <input
              value={form.duration_text}
              onChange={(e) => update('duration_text', e.target.value)}
              placeholder="e.g. 6 weeks (leave blank if not set)"
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value as CatalogCategoryId | '')}
              className="input"
            >
              <option value="">No category</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_competition}
              onChange={(e) => update('is_competition', e.target.checked)}
            />
            This is a VATTAMS Competition entry
          </label>
        </div>
        <p className="-mt-2 text-xs text-slate-muted">
          Competition entries are excluded from the public Courses page and listed on /competitions instead.
        </p>
        <Field label="Instructor name">
          <input
            value={form.instructor_name}
            onChange={(e) => update('instructor_name', e.target.value)}
            placeholder="Leave blank if not yet assigned"
            className="input"
          />
        </Field>
        <Field label="Cover image URL" error={fieldErrors.cover_image_url}>
          <input value={form.cover_image_url} onChange={(e) => update('cover_image_url', e.target.value)} className="input" />
          {form.cover_image_url.trim() && isPlausibleUrl(form.cover_image_url.trim()) && (
            <img src={form.cover_image_url.trim()} alt="" className="mt-2 h-32 w-full rounded-card object-cover" />
          )}
        </Field>
        <Field label="Preview video URL" error={fieldErrors.preview_video_url}>
          <input
            value={form.preview_video_url}
            onChange={(e) => update('preview_video_url', e.target.value)}
            placeholder="Leave blank if there's no preview video"
            className="input"
          />
        </Field>

        <div className="card p-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_free} onChange={(e) => update('is_free', e.target.checked)} />
            This is a free course
          </label>
          {!form.is_free && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Base fee (₹)" error={fieldErrors.base_fee}>
                <input
                  type="number"
                  min={0}
                  value={form.base_fee}
                  onChange={(e) => update('base_fee', Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="Discount (₹)" error={fieldErrors.discount_amount}>
                <input
                  type="number"
                  min={0}
                  value={form.discount_amount}
                  onChange={(e) => update('discount_amount', Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
          )}
          {!form.is_free && form.base_fee >= 0 && form.discount_amount >= 0 && (
            <p className="mt-3 text-sm text-parchment/90">
              Final payable price: <span className="font-semibold text-gold-bright">
                ₹{Math.max(form.base_fee - form.discount_amount, 0).toLocaleString('en-IN')}
              </span>
            </p>
          )}
          <p className="mt-3 text-xs text-slate-muted">
            This is the single source of truth for price. Changing it here updates what every
            student sees immediately — nothing is hardcoded on the payment page.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_featured} onChange={(e) => update('is_featured', e.target.checked)} />
          Feature this course on the homepage
        </label>

        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => update('is_published', e.target.checked)}
            />
            Published (visible to students)
          </label>
        )}

        {isNew ? (
          <div className="card p-4">
            <h2 className="text-sm font-medium">Course PDF / Study Material</h2>
            <p className="mt-2 text-sm text-slate-muted">
              Save this course first — attaching a PDF needs a saved course to link it to.
            </p>
          </div>
        ) : (
          <CoursePdfCard
            courseId={id as string}
            adminUid={adminUser?.uid ?? ''}
            adminName={adminProfile?.full_name ?? null}
            courseName={form.name}
          />
        )}

        {saveError && (
          <div className="rounded-card border border-danger/40 bg-danger/5 p-3">
            <p className="text-sm font-medium text-danger">{saveError.headline}</p>
            <p className="mt-1 text-xs text-slate-muted">{saveError.detail}</p>
          </div>
        )}
        {saved && <p className="text-sm text-success">Saved.</p>}

        <div className="flex gap-3 pt-2">
          {isNew ? (
            <>
              <button onClick={() => handleSave()} disabled={saving} className="btn-secondary disabled:opacity-60">
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? 'Saving…' : 'Save & publish'}
              </button>
            </>
          ) : (
            <button onClick={() => handleSave(form.is_published)} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  )
}
