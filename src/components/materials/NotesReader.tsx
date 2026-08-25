// Reading view for 'notes' materials. Notes are stored as plain text
// (see the `content` field on Material) — this project has no rich
// text editor dependency, and the brief says not to introduce a large
// editor dependency unless genuinely necessary, so notes use the same
// "plain text, paragraph breaks preserved" convention already used for
// course.description and lesson.content elsewhere in the app
// (whitespace-pre-line), just with reading-focused typography.
export default function NotesReader({ title, content }: { title: string; content: string }) {
  return (
    <div className="h-full overflow-y-auto bg-ink px-4 py-8 sm:px-10">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-2xl text-parchment">{title}</h2>
        <div className="rule-gold mt-4" />
        <p className="mt-6 whitespace-pre-line font-body text-[15px] leading-8 text-parchment/90">
          {content || 'This note has no content yet.'}
        </p>
      </div>
    </div>
  )
}
