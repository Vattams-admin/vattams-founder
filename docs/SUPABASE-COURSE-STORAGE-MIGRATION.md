# VATTAMS ACADEMIA — Course Material Storage Migration

## Storage architecture

- Firebase Authentication: unchanged.
- Firebase Firestore: unchanged; it remains the source of truth for courses and material metadata.
- Supabase Storage: now stores course PDF/image/video binaries only.
- Supabase project URL: `https://ljnfktzrjewqjxxchvud.supabase.co`.
- The logical object path remains `courses/{courseId}/materials/{materialId}/{filename}` so existing Firestore metadata stays coherent.
- Firebase Storage is no longer used by the Learning Materials module.

## Required deployment variables

Set these in the Vite deployment environment:

- `VITE_SUPABASE_URL=https://ljnfktzrjewqjxxchvud.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<Supabase project anon/publishable key>`
- `VITE_SUPABASE_STORAGE_BUCKET=<existing Supabase Storage bucket name>`

The Supabase URL and publishable key have now been supplied. The Storage bucket name is still required and is intentionally not invented in source.

## Important security note

This version keeps the existing Firebase Auth + Firestore authorization model and uses Supabase Storage as the file store. Because the frontend does not sign users into Supabase Auth, the current adapter expects a **public-read bucket** for direct student file URLs. Upload/delete requests use the Supabase anon key and therefore depend on the bucket's Storage policies.

For a stricter private-bucket production model, the next step is a server-side/Edge Function upload + signed-URL boundary that validates the existing Firebase identity before issuing Supabase Storage operations. Do not put a Supabase service-role key in the Vite frontend.
