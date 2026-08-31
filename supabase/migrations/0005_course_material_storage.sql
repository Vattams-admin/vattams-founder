-- VATTAMS ACADEMIA
-- Private Supabase Storage bucket for course materials.
--
-- Course metadata/modules/lessons/enrolments/progress remain in Firestore.
-- Only course material files are stored in Supabase Storage.
--
-- Access is mediated by the course-material Edge Function:
--   Firebase ID token -> Edge Function -> Firestore authorization
--   -> Supabase service-role Storage operation.
--
-- Therefore the bucket must remain PRIVATE.

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'academia-course-materials',
  'academia-course-materials',
  false
)
on conflict (id) do update
set
  name = excluded.name,
  public = false;
