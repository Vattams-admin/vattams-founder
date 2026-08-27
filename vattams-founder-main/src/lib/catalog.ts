// Single source of truth for the three catalog categories used across
// the app. There is no separate Firestore `categories` collection in
// this project (see src/types/database.ts), so `category_id` on a
// Course is just one of these slugs, stored as a plain string.
//
// Added alongside the academy course catalog seed (see
// scripts/seed-catalog.mjs) — existing courses created before this
// change simply have category_id: null and keep working exactly as
// before (Courses.tsx treats "no category" as its own filter state).

export type CatalogCategoryId =
  | 'competitive-exams'
  | 'academic-skill'
  | 'vattams-competitions'

export const CATALOG_CATEGORIES: { id: CatalogCategoryId; label: string }[] = [
  { id: 'competitive-exams', label: 'Competitive Exams' },
  { id: 'academic-skill', label: 'Academic & Skill' },
  { id: 'vattams-competitions', label: 'VATTAMS Competitions' },
]

export function getCategoryLabel(categoryId: string | null): string | null {
  if (!categoryId) return null
  return CATALOG_CATEGORIES.find((c) => c.id === categoryId)?.label ?? null
}
