# VATTAMS ACADEMIA — Course Material Storage Architecture

## Storage architecture

- Firebase Authentication: unchanged.
- Firebase Firestore: unchanged; it remains the source of truth for courses, course_modules, course_lessons, course_progress, enrolments, and material metadata (`courses/{courseId}/materials/{materialId}`).
- Supabase Storage: stores the actual binary files — course PDFs/images/videos (Learning Materials) and lesson videos/PDFs — in a **private** bucket (`academia-course-materials`). Firebase Storage is not used for any of this.
- Object paths:
  - Learning Materials: `courses/{courseId}/materials/{materialId}/{filename}`
  - Lesson files: `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}/{filename}`
- Supabase project URL / anon key: read from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at runtime — not hardcoded anywhere in source (see `src/lib/supabase.ts`, `src/lib/supabaseStorage.ts`).

## Authorization: Supabase Edge Function `course-material`

The bucket is private — there is no public-read policy and no `getPublicUrl()` anywhere in this codebase. All access goes through the `course-material` Edge Function (`supabase/functions/course-material/index.ts`), which:

- validates the caller's Firebase ID token and resolves their Firebase UID;
- for `create-upload-url` / `delete`: requires admin (checked against Firestore `admins/{uid}`);
- for `create-download-url`: requires either admin, or an active enrolment (`enrolments/{uid}_{courseId}`, `status == 'active'`) **and** verification, via Firestore, that the requested path actually belongs to a real material/lesson of that course — an enrolment for course A can never unlock a path under course B, and an unpublished (draft) material can never be opened by a student even if they know its exact path;
- validates the requested Storage path strictly against the two shapes above (rejects traversal, absolute paths, and any other shape) before doing anything with it;
- holds the `SUPABASE_SERVICE_ROLE_KEY` as a Deno server-side env var — it is never sent to, or reachable from, the frontend (no `VITE_`-prefixed service-role variable exists).

Signed upload/download URLs are short-lived and are generated on demand — the frontend never persists one to Firestore, and there is no public/permanent Storage URL anywhere in this flow.

## Required deployment variables

- `VITE_FIREBASE_*` — Firebase Auth/Firestore config (unchanged).
- `VITE_SUPABASE_URL` — the Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/publishable key (used only to call the Edge Function and to `PUT` to a signed upload URL — it has no direct Storage read/write rights of its own on this private bucket).
- `VITE_SUPABASE_STORAGE_BUCKET` — present in `.env.example` for documentation, but the bucket name is currently hardcoded as `academia-course-materials` in three places (`src/lib/supabaseStorage.ts`, `src/pages/admin/AdminCourseContent.tsx`, `supabase/functions/course-material/index.ts`) rather than read from this variable. Keep those three in sync if the bucket is ever renamed.
- `SUPABASE_SERVICE_ROLE_KEY` — Edge Function environment only (Supabase project settings), never a Vite/frontend variable.

