-- Retire broad Storage access policies on empty legacy buckets.
-- The active Academia buckets are separate, private buckets accessed through
-- Firebase-authenticated Edge Functions. Do not remove or move any objects.
--
-- The legacy buckets were verified empty immediately before this migration.
-- No objects are deleted; the access policy cleanup is scoped to these legacy buckets.
-- No technician photos currently exist. Make this empty legacy bucket private
-- so a future upload cannot become world-readable by default.
UPDATE storage.buckets
SET public = false,
    updated_at = now()
WHERE id = 'technician-photos';

-- Remove anonymous writes/reads from empty legacy technician buckets.
DROP POLICY IF EXISTS anon_insert_technician_docs ON storage.objects;
DROP POLICY IF EXISTS anon_update_technician_docs ON storage.objects;
DROP POLICY IF EXISTS anon_insert_technician_photos ON storage.objects;
DROP POLICY IF EXISTS anon_update_technician_photos ON storage.objects;
DROP POLICY IF EXISTS anon_select_technician_photos ON storage.objects;

-- The old course-materials bucket is empty and is not the active
-- academia-course-materials bucket. Supabase Auth is not the Academia auth
-- provider, so remove the old authenticated-role mutation path.
DROP POLICY IF EXISTS "course materials authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "course materials authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "course materials authenticated delete" ON storage.objects;
