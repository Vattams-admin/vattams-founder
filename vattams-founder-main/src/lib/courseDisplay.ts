// Some course records were authored under an old name in the database
// (e.g. "Spoken English"). We never rename the stored value — only what
// the public UI displays. Add more entries here if other courses need
// the same treatment.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'spoken english': 'Public Speaking',
}

export function getCourseDisplayName(name: string): string {
  const override = DISPLAY_NAME_OVERRIDES[name.trim().toLowerCase()]
  return override ?? name
}
