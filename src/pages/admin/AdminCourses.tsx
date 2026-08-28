import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import AdminNav from '@/components/AdminNav'
import type { Course } from '@/types/database'
import { CATALOG_CATEGORIES, getCategoryLabel } from '@/lib/catalog'
import { classifyFirestoreError, type ClassifiedFirestoreError } from '@/lib/firestoreErrors'

type LoadState = 'loading' | 'loaded' | 'error'
type PublishFilter = 'all' | 'published' | 'unpublished'
type FeaturedFilter = 'all' | 'featured' | 'not-featured'
type SortKey = 'name' | 'newest' | 'price-high' | 'price-low'

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<ClassifiedFirestoreError | null>(null)
  const [search, setSearch] = useState('')
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all')
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [competitionsOnly, setCompetitionsOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setState('loading')
    setLoadError(null)
    try {
      // No `where` here on purpose — the admin needs to see drafts too,
      // not just is_published: true rows (that filter is what the
      // public Courses.tsx page applies).
      const snapshot = await getDocs(collection(firestore, 'courses'))
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Course[]
      setCourses(rows)
      setState('loaded')
    } catch (err) {
      setLoadError(classifyFirestoreError(err, 'AdminCourses: list courses'))
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    const rows = courses.filter((c) => {
      if (publishFilter === 'published' && !c.is_published) return false
      if (publishFilter === 'unpublished' && c.is_published) return false
      if (featuredFilter === 'featured' && !c.is_featured) return false
      if (featuredFilter === 'not-featured' && c.is_featured) return false
      if (categoryFilter !== 'all' && c.category_id !== categoryFilter) return false
      if (competitionsOnly && !c.is_competition) return false

      if (!term) return true
      return [c.name, c.slug, c.instructor_name].filter(Boolean).join(' ').toLowerCase().includes(term)
    })

    return rows.sort((a, b) => {
      switch (sortKey) {
        case 'newest':
          return (b.created_at ?? '').localeCompare(a.created_at ?? '')
        case 'price-high':
          return b.base_fee - a.base_fee
        case 'price-low':
          return a.base_fee - b.base_fee
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [courses, search, publishFilter, featuredFilter, categoryFilter, competitionsOnly, sortKey])

  const availableCategories = useMemo(() => {
    const found = new Set<string>()
    for (const c of courses) if (c.category_id) found.add(c.category_id)
    return CATALOG_CATEGORIES.filter((cat) => found.has(cat.id))
  }, [courses])

  async function togglePublish(course: Course) {
    setBusyId(course.id)
    setActionError(null)
    try {
      await updateDoc(doc(firestore, 'courses', course.id), { is_published: !course.is_published })
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c)))
    } catch (err) {
      setActionError(classifyFirestoreError(err, 'AdminCourses: toggle publish').detail)
    } finally {
      setBusyId(null)
    }
  }

  async function toggleFeatured(course: Course) {
    setBusyId(course.id)
    setActionError(null)
    try {
      await updateDoc(doc(firestore, 'courses', course.id), { is_featured: !course.is_featured })
      setCourses((prev) => prev.map((c) => (c.id === course.id ? { ...c, is_featured: !c.is_featured } : c)))
    } catch (err) {
      setActionError(classifyFirestoreError(err, 'AdminCourses: toggle featured').detail)
    } finally {
      setBusyId(null)
    }
  }

  // A course with any payment or enrolment history must never be hard
  // deleted — those records reference course_id, and CourseDetail /
  // CourseLearn / AdminPayments would be left pointing at nothing. This
  // checks both collections (limit 1 each, so it's cheap) before
  // allowing the destructive path; if either has a match, the course
  // can still be hidden via Unpublish (the existing, safe mechanism)
  // but not deleted.
  async function remove(course: Course) {
    setBusyId(course.id)
    setActionError(null)
    try {
      const [paymentsSnap, enrolmentsSnap] = await Promise.all([
        getDocs(query(collection(firestore, 'payments'), where('course_id', '==', course.id), limit(1))),
        getDocs(query(collection(firestore, 'enrolments'), where('course_id', '==', course.id), limit(1)))
      ])

      if (!paymentsSnap.empty || !enrolmentsSnap.empty) {
        setActionError(
          `"${course.name}" has existing payment or enrolment records and can't be deleted — this would orphan that history. Use Unpublish instead to remove it from public listings while keeping the records intact.`
        )
        setBusyId(null)
        return
      }
    } catch (err) {
      setActionError(classifyFirestoreError(err, 'AdminCourses: delete safety check').detail)
      setBusyId(null)
      return
    }

    if (!window.confirm(`Delete "${course.name}"? This cannot be undone.`)) {
      setBusyId(null)
      return
    }

    try {
      await deleteDoc(doc(firestore, 'courses', course.id))
      setCourses((prev) => prev.filter((c) => c.id !== course.id))
    } catch (err) {
      setActionError(classifyFirestoreError(err, 'AdminCourses: delete course').detail)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <AdminNav active="courses" />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Courses</h1>
        <Link to="/admin/courses/new" className="btn-primary text-sm">
          New course
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, slug, or instructor…"
          className="input max-w-sm"
        />

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['all', 'published', 'unpublished'] as PublishFilter[]).map((key) => (
            <FilterChip key={key} active={publishFilter === key} onClick={() => setPublishFilter(key)}>
              {key === 'all' ? 'All' : key === 'published' ? 'Published' : 'Unpublished'}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-white/15" />
          {(['all', 'featured', 'not-featured'] as FeaturedFilter[]).map((key) => (
            <FilterChip key={key} active={featuredFilter === key} onClick={() => setFeaturedFilter(key)}>
              {key === 'all' ? 'Any' : key === 'featured' ? 'Featured' : 'Not featured'}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-white/15" />
          <FilterChip active={competitionsOnly} onClick={() => setCompetitionsOnly((v) => !v)}>
            Competitions only
          </FilterChip>

          {availableCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input h-auto w-auto py-1 text-xs"
            >
              <option value="all">All categories</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          )}

          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="input ml-auto h-auto w-auto py-1 text-xs">
            <option value="name">Sort: Name (A–Z)</option>
            <option value="newest">Sort: Newest</option>
            <option value="price-high">Sort: Price (high–low)</option>
            <option value="price-low">Sort: Price (low–high)</option>
          </select>
        </div>
      </div>

      {actionError && <p className="mt-4 text-sm text-danger">{actionError}</p>}

      {state === 'error' && loadError && (
        <div className="mt-8 card border-danger/40 p-8 text-center">
          <p className="font-display text-lg text-danger">{loadError.headline}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-muted">{loadError.detail}</p>
          <button onClick={load} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {state === 'loading' && <p className="mt-8 text-sm text-slate-muted">Loading…</p>}

      {state === 'loaded' && filtered.length === 0 && (
        <p className="mt-8 text-sm text-slate-muted">
          {courses.length === 0 ? 'No courses yet.' : 'No courses match this view.'}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {state === 'loaded' &&
          filtered.map((course) => (
            <div key={course.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">
                  {course.name}
                  {course.is_competition && (
                    <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold">
                      Competition
                    </span>
                  )}
                </p>
                <p className="text-slate-muted">
                  /{course.slug} · {course.is_free ? 'Free' : `₹${course.base_fee.toLocaleString('en-IN')}`}
                  {course.instructor_name ? ` · ${course.instructor_name}` : ''}
                  {getCategoryLabel(course.category_id) ? ` · ${getCategoryLabel(course.category_id)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    course.is_published ? 'bg-success/20 text-success' : 'bg-gold/20 text-gold'
                  }`}
                >
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
                {course.is_featured && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs uppercase tracking-wide text-gold">
                    Featured
                  </span>
                )}
                <button
                  onClick={() => togglePublish(course)}
                  disabled={busyId === course.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => toggleFeatured(course)}
                  disabled={busyId === course.id}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {course.is_featured ? 'Unfeature' : 'Feature'}
                </button>
                <Link to={`/admin/courses/${course.id}`} className="btn-secondary text-xs">
                  Edit
                </Link>
                <button
                  onClick={() => remove(course)}
                  disabled={busyId === course.id}
                  className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-semibold uppercase tracking-wide transition-colors ${
        active
          ? 'border-gold bg-gold/15 text-gold-bright'
          : 'border-white/15 text-slate-muted hover:border-gold/40 hover:text-parchment'
      }`}
    >
      {children}
    </button>
  )
}
