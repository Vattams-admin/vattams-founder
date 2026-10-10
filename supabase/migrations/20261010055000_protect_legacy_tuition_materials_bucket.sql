-- The legacy tuition-materials-protected bucket was marked public even though
-- it contains zero objects. Keep it private and remove the blanket public read
-- policy so a future upload cannot accidentally become world-readable.
-- Academia's active course files remain in the separate private
-- academia-course-materials bucket; no files are moved or deleted.

UPDATE storage.buckets
SET public = false,
    updated_at = now()
WHERE id = 'tuition-materials-protected';

DROP POLICY IF EXISTS public_select_tuition_materials_protected
  ON storage.objects;
