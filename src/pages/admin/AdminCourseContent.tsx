import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { deleteCourseMaterialFile } from '@/lib/supabaseStorage'
import AdminNav from '@/components/AdminNav'
import { firebaseAuth } from '@/lib/firebase'

const BUCKET = 'academia-course-materials'

interface ModuleRow {
  id: string
  title: string
  sort_order: number
}

interface LessonRow {
  id: string
  module_id: string
  title: string
  content: string
  video_path: string | null
  pdf_path: string | null
  video_url: string | null
  pdf_url: string | null
  sort_order: number
}

async function getSignedUploadUrl(path: string) {
  const currentUser = firebaseAuth.currentUser

  if (!currentUser) {
    throw new Error('Admin authentication required.')
  }

  const idToken = await currentUser.getIdToken()

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/course-material`,
    {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create-upload-url',
        path,
      }),
    }
  )

  const data = await response.json()

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'Unable to create upload URL')
  }

  return data as {
    ok: true
    path: string
    token: string
  }
}

async function uploadCourseFile(
  file: File,
  courseId: string,
  moduleId: string,
  lessonId: string,
  type: 'video' | 'pdf'
) {
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')

  const path =
    `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/` +
    `${type}-${Date.now()}-${safeName}`

  const signed = await getSignedUploadUrl(path)

  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file)

  if (error) {
    throw new Error(error.message)
  }

  return signed.path
}

export default function AdminCourseContent() {
  const { id: courseId } = useParams<{ id: string }>()

  const [courseName, setCourseName] = useState('')
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editingModuleTitle, setEditingModuleTitle] = useState('')

  const [newLessonModuleId, setNewLessonModuleId] = useState<string | null>(null)
  const [newLessonTitle, setNewLessonTitle] = useState('')
  const [newLessonContent, setNewLessonContent] = useState('')

  const [uploading, setUploading] = useState<string | null>(null)

  async function loadContent() {
    if (!courseId) return

    setLoading(true)
    setError(null)

    try {
      const courseSnap = await getDoc(doc(firestore, 'courses', courseId))

      if (!courseSnap.exists()) {
        throw new Error('Course not found')
      }

      setCourseName(String(courseSnap.data().name ?? 'Course'))

      const moduleSnapshot = await getDocs(
        query(
          collection(firestore, 'course_modules'),
          orderBy('sort_order', 'asc')
        )
      )

      const moduleRows = moduleSnapshot.docs
        .map((item) => ({
          id: item.id,
          title: String(item.data().title ?? ''),
          sort_order: Number(item.data().sort_order ?? 0),
          course_id: item.data().course_id,
        }))
        .filter((item) => item.course_id === courseId)
        .map(({ course_id: _courseId, ...item }) => item)

      const lessonSnapshot = await getDocs(
        query(
          collection(firestore, 'course_lessons'),
          orderBy('sort_order', 'asc')
        )
      )

      const lessonRows = lessonSnapshot.docs
        .map((item) => ({
          id: item.id,
          module_id: String(item.data().module_id ?? ''),
          title: String(item.data().title ?? ''),
          content: String(item.data().content ?? ''),
          video_path: item.data().video_path ?? null,
          pdf_path: item.data().pdf_path ?? null,
          video_url: item.data().video_url ?? null,
          pdf_url: item.data().pdf_url ?? null,
          sort_order: Number(item.data().sort_order ?? 0),
          course_id: item.data().course_id,
        }))
        .filter((item) => item.course_id === courseId)
        .map(({ course_id: _courseId, ...item }) => item)

      setModules(moduleRows)
      setLessons(lessonRows)
    } catch (err) {
      console.error('Failed to load course content:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load course content.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [courseId])

  async function addModule() {
    if (!courseId || !newModuleTitle.trim()) return

    setSaving(true)
    setError(null)

    try {
      const nextOrder =
        modules.length > 0
          ? Math.max(...modules.map((item) => item.sort_order)) + 1
          : 1

      const created = await addDoc(
        collection(firestore, 'course_modules'),
        {
          course_id: courseId,
          title: newModuleTitle.trim(),
          sort_order: nextOrder,
        }
      )

      setModules((current) => [
        ...current,
        {
          id: created.id,
          title: newModuleTitle.trim(),
          sort_order: nextOrder,
        },
      ])

      setNewModuleTitle('')
    } catch (err) {
      console.error('Failed to add module:', err)
      setError('Unable to add module.')
    } finally {
      setSaving(false)
    }
  }

  async function saveModule(moduleId: string) {
    if (!editingModuleTitle.trim()) return

    setSaving(true)
    setError(null)

    try {
      await updateDoc(doc(firestore, 'course_modules', moduleId), {
        title: editingModuleTitle.trim(),
      })

      setModules((current) =>
        current.map((item) =>
          item.id === moduleId
            ? { ...item, title: editingModuleTitle.trim() }
            : item
        )
      )

      setEditingModuleId(null)
      setEditingModuleTitle('')
    } catch (err) {
      console.error('Failed to update module:', err)
      setError('Unable to update module.')
    } finally {
      setSaving(false)
    }
  }

  async function removeModule(moduleId: string) {
    if (
      !window.confirm(
        'Delete this module? Lessons inside it will also need to be removed.'
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)

    const storageWarnings: string[] = []

    try {
      const moduleLessons = lessons.filter(
        (lesson) => lesson.module_id === moduleId
      )

      for (const lesson of moduleLessons) {
        if (lesson.video_path) {
          try {
            await deleteCourseMaterialFile(lesson.video_path)
          } catch (err) {
            console.error('Failed to delete lesson video from storage:', err)
            storageWarnings.push(`video for "${lesson.title}"`)
          }
        }

        if (lesson.pdf_path) {
          try {
            await deleteCourseMaterialFile(lesson.pdf_path)
          } catch (err) {
            console.error('Failed to delete lesson PDF from storage:', err)
            storageWarnings.push(`PDF for "${lesson.title}"`)
          }
        }

        await deleteDoc(doc(firestore, 'course_lessons', lesson.id))
      }

      await deleteDoc(doc(firestore, 'course_modules', moduleId))

      setModules((current) =>
        current.filter((item) => item.id !== moduleId)
      )

      setLessons((current) =>
        current.filter((item) => item.module_id !== moduleId)
      )

      if (storageWarnings.length > 0) {
        setError(
          `Module deleted, but some files could not be removed from storage: ${storageWarnings.join(', ')}. Contact support to clean them up manually.`
        )
      }
    } catch (err) {
      console.error('Failed to delete module:', err)
      setError('Unable to delete module.')
    } finally {
      setSaving(false)
    }
  }

  async function addLesson(moduleId: string) {
    if (!courseId || !newLessonTitle.trim()) return

    setSaving(true)
    setError(null)

    try {
      const moduleLessons = lessons.filter(
        (lesson) => lesson.module_id === moduleId
      )

      const nextOrder =
        moduleLessons.length > 0
          ? Math.max(...moduleLessons.map((item) => item.sort_order)) + 1
          : 1

      const created = await addDoc(
        collection(firestore, 'course_lessons'),
        {
          course_id: courseId,
          module_id: moduleId,
          title: newLessonTitle.trim(),
          content: newLessonContent.trim() || null,
          video_url: null,
          pdf_url: null,
          video_path: null,
          pdf_path: null,
          sort_order: nextOrder,
        }
      )

      setLessons((current) => [
        ...current,
        {
          id: created.id,
          module_id: moduleId,
          title: newLessonTitle.trim(),
          content: newLessonContent.trim(),
          video_path: null,
          pdf_path: null,
          video_url: null,
          pdf_url: null,
          sort_order: nextOrder,
        },
      ])

      setNewLessonModuleId(null)
      setNewLessonTitle('')
      setNewLessonContent('')
    } catch (err) {
      console.error('Failed to add lesson:', err)
      setError('Unable to add lesson.')
    } finally {
      setSaving(false)
    }
  }

  async function updateLesson(
    lessonId: string,
    patch: Partial<LessonRow>
  ) {
    setSaving(true)
    setError(null)

    try {
      await updateDoc(doc(firestore, 'course_lessons', lessonId), patch)

      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, ...patch }
            : lesson
        )
      )
    } catch (err) {
      console.error('Failed to update lesson:', err)
      setError('Unable to update lesson.')
    } finally {
      setSaving(false)
    }
  }

  async function removeLesson(lessonId: string) {
    if (!window.confirm('Delete this lesson?')) return

    setSaving(true)
    setError(null)

    const targetLesson = lessons.find((lesson) => lesson.id === lessonId)
    const storageWarnings: string[] = []

    // Storage cleanup happens before the Firestore doc is removed —
    // if a delete fails we still remove the lesson (that's the
    // admin's explicit intent), but we surface exactly what wasn't
    // cleaned up rather than silently reporting success.
    if (targetLesson?.video_path) {
      try {
        await deleteCourseMaterialFile(targetLesson.video_path)
      } catch (err) {
        console.error('Failed to delete lesson video from storage:', err)
        storageWarnings.push('the video file')
      }
    }

    if (targetLesson?.pdf_path) {
      try {
        await deleteCourseMaterialFile(targetLesson.pdf_path)
      } catch (err) {
        console.error('Failed to delete lesson PDF from storage:', err)
        storageWarnings.push('the PDF file')
      }
    }

    try {
      await deleteDoc(doc(firestore, 'course_lessons', lessonId))

      setLessons((current) =>
        current.filter((lesson) => lesson.id !== lessonId)
      )

      if (storageWarnings.length > 0) {
        setError(
          `Lesson deleted, but ${storageWarnings.join(' and ')} could not be removed from storage. Contact support to clean it up manually.`
        )
      }
    } catch (err) {
      console.error('Failed to delete lesson:', err)
      setError('Unable to delete lesson.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(
    lesson: LessonRow,
    type: 'video' | 'pdf',
    file: File
  ) {
    if (!courseId) return

    setUploading(`${lesson.id}:${type}`)
    setError(null)

    try {
      const path = await uploadCourseFile(
        file,
        courseId,
        lesson.module_id,
        lesson.id,
        type
      )

      const previousPath = type === 'video' ? lesson.video_path : lesson.pdf_path

      if (type === 'video') {
        await updateLesson(lesson.id, {
          video_path: path,
          video_url: null,
        })
      } else {
        await updateLesson(lesson.id, {
          pdf_path: path,
          pdf_url: null,
        })
      }

      // Only remove the old file once the new one is uploaded AND
      // Firestore points at it — never the other way round, so a
      // failed upload/update never leaves the lesson referencing a
      // deleted file.
      if (previousPath && previousPath !== path) {
        try {
          await deleteCourseMaterialFile(previousPath)
        } catch (err) {
          // Non-fatal: the replacement itself succeeded. The old file
          // is just orphaned in storage rather than lost/broken.
          console.error('Failed to delete previous lesson file from storage:', err)
        }
      }
    } catch (err) {
      console.error('Course material upload failed:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload course material.'
      )
    } finally {
      setUploading(null)
    }
  }

  if (!courseId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        Invalid course.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-slate-muted">
        Loading course content…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <AdminNav active="courses" />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-muted">Course content</p>
          <h1 className="font-display text-3xl">{courseName}</h1>
        </div>

        <Link
          to={`/admin/courses/${courseId}`}
          className="btn-secondary text-sm"
        >
          Edit course details
        </Link>
      </div>

      {error && (
        <div className="mt-5 rounded-card border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="card mt-6 p-5">
        <h2 className="font-display text-xl">Modules</h2>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newModuleTitle}
            onChange={(event) => setNewModuleTitle(event.target.value)}
            placeholder="Module title"
            className="input flex-1"
          />

          <button
            onClick={addModule}
            disabled={saving || !newModuleTitle.trim()}
            className="btn-primary disabled:opacity-50"
          >
            Add module
          </button>
        </div>
      </section>

      <div className="mt-6 space-y-5">
        {modules.map((module) => {
          const moduleLessons = lessons
            .filter((lesson) => lesson.module_id === module.id)
            .sort((a, b) => a.sort_order - b.sort_order)

          return (
            <section key={module.id} className="card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {editingModuleId === module.id ? (
                  <div className="flex flex-1 gap-2">
                    <input
                      value={editingModuleTitle}
                      onChange={(event) =>
                        setEditingModuleTitle(event.target.value)
                      }
                      className="input"
                    />

                    <button
                      onClick={() => saveModule(module.id)}
                      disabled={saving}
                      className="btn-primary text-sm"
                    >
                      Save
                    </button>

                    <button
                      onClick={() => setEditingModuleId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gold">
                      Module {module.sort_order}
                    </p>
                    <h2 className="font-display text-xl">
                      {module.title}
                    </h2>
                  </div>
                )}

                {editingModuleId !== module.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingModuleId(module.id)
                        setEditingModuleTitle(module.title)
                      }}
                      className="btn-secondary text-xs"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => removeModule(module.id)}
                      disabled={saving}
                      className="rounded-card border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {moduleLessons.map((lesson) => (
                  <LessonEditor
                    key={lesson.id}
                    lesson={lesson}
                    saving={saving}
                    uploading={uploading}
                    onSave={updateLesson}
                    onDelete={removeLesson}
                    onUpload={handleUpload}
                  />
                ))}

                {newLessonModuleId === module.id ? (
                  <div className="rounded-card border border-gold/20 p-4">
                    <h3 className="font-medium">New lesson</h3>

                    <input
                      value={newLessonTitle}
                      onChange={(event) =>
                        setNewLessonTitle(event.target.value)
                      }
                      placeholder="Lesson title"
                      className="input mt-3"
                    />

                    <textarea
                      value={newLessonContent}
                      onChange={(event) =>
                        setNewLessonContent(event.target.value)
                      }
                      placeholder="Lesson content (optional)"
                      rows={4}
                      className="input mt-3"
                    />

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => addLesson(module.id)}
                        disabled={saving || !newLessonTitle.trim()}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        Add lesson
                      </button>

                      <button
                        onClick={() => setNewLessonModuleId(null)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewLessonModuleId(module.id)
                      setNewLessonTitle('')
                      setNewLessonContent('')
                    }}
                    className="btn-secondary text-sm"
                  >
                    + Add lesson
                  </button>
                )}

                {moduleLessons.length === 0 &&
                  newLessonModuleId !== module.id && (
                    <p className="text-sm text-slate-muted">
                      No lessons in this module yet.
                    </p>
                  )}
              </div>
            </section>
          )
        })}

        {modules.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-muted">
            No modules yet. Add the first module above.
          </div>
        )}
      </div>
    </div>
  )
}

function LessonEditor({
  lesson,
  saving,
  uploading,
  onSave,
  onDelete,
  onUpload,
}: {
  lesson: LessonRow
  saving: boolean
  uploading: string | null
  onSave: (id: string, patch: Partial<LessonRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpload: (
    lesson: LessonRow,
    type: 'video' | 'pdf',
    file: File
  ) => Promise<void>
}) {
  const [title, setTitle] = useState(lesson.title)
  const [content, setContent] = useState(lesson.content)

  return (
    <div className="rounded-card border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-muted">
          Lesson {lesson.sort_order}
        </p>

        <button
          onClick={() => onDelete(lesson.id)}
          disabled={saving}
          className="text-xs font-semibold text-danger"
        >
          Delete
        </button>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="input mt-2"
      />

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={4}
        placeholder="Lesson content"
        className="input mt-3"
      />

      <button
        onClick={() =>
          onSave(lesson.id, {
            title: title.trim(),
            content: content.trim(),
          })
        }
        disabled={saving || !title.trim()}
        className="btn-primary mt-3 text-sm disabled:opacity-50"
      >
        Save lesson
      </button>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-white/10 p-3">
          <p className="text-sm font-medium">Video</p>

          {lesson.video_path && (
            <p className="mt-1 break-all text-xs text-success">
              Uploaded: {lesson.video_path}
            </p>
          )}

          <input
            type="file"
            accept="video/*"
            className="mt-3 block w-full text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(lesson, 'video', file)
            }}
          />

          {uploading === `${lesson.id}:video` && (
            <p className="mt-2 text-xs text-gold">
              Uploading video…
            </p>
          )}
        </div>

        <div className="rounded-card border border-white/10 p-3">
          <p className="text-sm font-medium">PDF</p>

          {lesson.pdf_path && (
            <p className="mt-1 break-all text-xs text-success">
              Uploaded: {lesson.pdf_path}
            </p>
          )}

          <input
            type="file"
            accept="application/pdf,.pdf"
            className="mt-3 block w-full text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(lesson, 'pdf', file)
            }}
          />

          {uploading === `${lesson.id}:pdf` && (
            <p className="mt-2 text-xs text-gold">
              Uploading PDF…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
