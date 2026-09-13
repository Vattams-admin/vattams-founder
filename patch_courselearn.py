import sys

path = "src/pages/CourseLearn.tsx"

with open(path, "r", encoding="utf-8") as f:
    s = f.read()

def apply(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print(f"ABORT: expected exactly 1 match for {label}, found {n}. No changes written.")
        sys.exit(1)
    return s.replace(old, new, 1)

old1 = """interface ProgressRow {
  lesson_id: string
  completed: boolean
}"""

new1 = """interface ProgressRow {
  lesson_id: string
  completed: boolean
}

// Lesson `content` is normally plain text typed into a simple textarea
// (see AdminCourseContent.tsx), but some lessons are bulk-authored and
// store a JSON-encoded structured object in that same field instead —
// title/objective/core_teaching_content/examples/etc. This type only
// describes the fields we know how to render; anything else in the
// object (course_id, module_id, lesson_id, sort_order, status, ...)
// is intentionally left untyped here and never rendered.
interface StructuredLessonContent {
  objective?: unknown
  core_teaching_content?: unknown
  examples?: unknown
  practical_activity?: unknown
  independent_practice?: unknown
  assessment_checkpoint?: unknown
  student_task?: unknown
  tutor_guidance?: unknown
  materials_requirement?: unknown
  reflection_completion?: unknown
  daily_flow?: unknown
  [key: string]: unknown
}

// Order mirrors the fields as they appear in the bulk-authored lesson
// JSON. `title` is intentionally excluded — the lesson's own title is
// already shown in the page heading, so repeating it here would just
// duplicate it. Internal metadata (course_id/module_id/lesson_id/
// sort_order/status) is excluded by simply not being in this list.
const STRUCTURED_LESSON_FIELDS: Array<{
  key: keyof StructuredLessonContent
  label: string
}> = [
  { key: 'objective', label: 'Objective' },
  { key: 'core_teaching_content', label: 'Lesson' },
  { key: 'examples', label: 'Examples' },
  { key: 'practical_activity', label: 'Practical Activity' },
  { key: 'independent_practice', label: 'Independent Practice' },
  { key: 'assessment_checkpoint', label: 'Assessment Checkpoint' },
  { key: 'student_task', label: 'Student Task' },
  { key: 'tutor_guidance', label: 'Tutor Guidance' },
  { key: 'materials_requirement', label: 'Materials Needed' },
  { key: 'reflection_completion', label: 'Reflection & Completion' },
  { key: 'daily_flow', label: 'Daily Flow' },
]

// Never throws: any parse failure or unexpected shape returns null so
// the caller falls back to rendering the original text untouched —
// plain-text lesson content keeps working exactly as before.
function parseStructuredLessonContent(
  raw: string
): StructuredLessonContent | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    const record = parsed as Record<string, unknown>
    const hasKnownField = STRUCTURED_LESSON_FIELDS.some(
      ({ key }) => record[key as string] != null
    )

    return hasKnownField ? (record as StructuredLessonContent) : null
  } catch {
    return null
  }
}

// Renders one field's value as readable UI: strings become paragraphs
// (whitespace preserved), arrays become bullet lists (recursing per
// item so an array of objects still shows readable text rather than
// "[object Object]"), and anything else falls back to a plain string.
// No dangerouslySetInnerHTML anywhere.
function renderLessonFieldValue(value: unknown) {
  if (value == null) return null

  if (typeof value === 'string') {
    if (!value.trim()) return null
    return <p className="whitespace-pre-line text-parchment/90">{value}</p>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="list-disc space-y-1 pl-5 text-parchment/90">
        {value.map((item, index) => (
          <li key={index} className="whitespace-pre-line">
            {typeof item === 'string' || typeof item === 'number'
              ? String(item)
              : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return null
    return (
      <ul className="space-y-1 text-parchment/90">
        {entries.map(([entryKey, entryValue]) => (
          <li key={entryKey}>
            <span className="font-medium">
              {entryKey.replace(/_/g, ' ')}:{' '}
            </span>
            {typeof entryValue === 'string'
              ? entryValue
              : JSON.stringify(entryValue)}
          </li>
        ))}
      </ul>
    )
  }

  return <p className="text-parchment/90">{String(value)}</p>
}"""

old2 = """  const activeLesson = useMemo(
    () =>
      lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [lessons, activeLessonId]
  )"""

new2 = """  const activeLesson = useMemo(
    () =>
      lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [lessons, activeLessonId]
  )

  // If `content` is a JSON-encoded structured lesson, this holds the
  // parsed object; otherwise null, and the raw text is rendered as
  // before (see the render block below).
  const structuredLessonContent = useMemo(
    () =>
      activeLesson?.content
        ? parseStructuredLessonContent(activeLesson.content)
        : null,
    [activeLesson?.content]
  )"""

old3 = """              {activeLesson.content && (
                <p className="mt-4 whitespace-pre-line text-parchment/90">
                  {activeLesson.content}
                </p>
              )}"""

new3 = """              {activeLesson.content && !structuredLessonContent && (
                <p className="mt-4 whitespace-pre-line text-parchment/90">
                  {activeLesson.content}
                </p>
              )}

              {structuredLessonContent && (
                <div className="mt-4 space-y-5">
                  {STRUCTURED_LESSON_FIELDS.map(({ key, label }) => {
                    const rendered = renderLessonFieldValue(
                      structuredLessonContent[key]
                    )
                    if (!rendered) return null

                    return (
                      <div key={key}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                          {label}
                        </p>
                        <div className="mt-1">{rendered}</div>
                      </div>
                    )
                  })}
                </div>
              )}"""

s = apply(s, old1, new1, "block 1 (types/helpers after ProgressRow)")
s = apply(s, old2, new2, "block 2 (structuredLessonContent memo)")
s = apply(s, old3, new3, "block 3 (render block)")

with open(path, "w", encoding="utf-8") as f:
    f.write(s)

print("Patched src/pages/CourseLearn.tsx successfully.")
