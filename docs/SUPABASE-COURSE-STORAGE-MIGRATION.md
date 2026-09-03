# VATTAMS ACADEMIA — Course Material Storage Migration

## Storage architecture

- Firebase Authentication: unchanged.
- Firebase Firestore: unchanged; it remains the source of truth for courses and material metadata.
- Supabase Storage: now stores course PDF/image/video binaries only.
- Supabase project URL: provided through `VITE_SUPABASE_URL` at deployment time.
- The logical object path remains `courses/{courseId}/materials/{materialId}/{filename}` so existing Firestore metadata stays coherent.
- Firebase Storage is no longer used by the Learning Materials module.

## Required deployment variables

Set these in the Vite deployment environment:

- `VITE_SUPABASE_URL=<Supabase project URL>`
- `VITE_SUPABASE_ANON_KEY=<Supabase project anon/publishable key>`
- `VITE_SUPABASE_STORAGE_BUCKET=<existing Supabase Storage bucket name>`

The Supabase URL and publishable key have now been supplied. The Storage bucket name is still required and is intentionally not invented in source.

## Important security note

This version keeps the existing Firebase Auth + Firestore authorization model and uses Supabase Storage as the private file store. The Firebase-authenticated Supabase Edge Function performs the privileged Storage operations and returns short-lived signed URLs; the Supabase service-role key is never exposed to the Vite frontend.

### Why the signed upload uses XHR instead of the SDK helper

The actual signed upload intentionally uses `XMLHttpRequest` rather than `supabase.storage.uploadToSignedUrl()`. The admin Learning Materials UI needs live upload progress, and XHR exposes `upload.onprogress`, while the SDK helper uses `fetch` internally without an equivalent upload-progress callback. The signed endpoint is still constructed from `VITE_SUPABASE_URL`, so this is a deliberate progress/UI requirement, not an SDK oversight.

Do not put a Supabase service-role key in the Vite frontend.
