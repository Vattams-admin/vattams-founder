-- VATTAMS ACADEMIA
-- Private Supabase Storage bucket for tutor onboarding documents
-- (₹500 payment + onboarding document workflow, Part B).
--
-- Tutor/document metadata (status, review decisions) remains in
-- Firestore at tutors/{tutorId}/onboarding_documents/{documentType}.
-- Only the document files themselves are stored here.
--
-- Access is mediated exclusively by the tutor-onboarding-document Edge
-- Function:
--   Firebase ID token -> Edge Function -> Firestore authorization
--   -> Supabase service-role Storage operation.
--
-- Therefore this bucket must remain PRIVATE — never made public, and
-- never given an anon/authenticated RLS policy that would let a client
-- read/write it directly with the anon key.

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'academia-tutor-onboarding-docs',
  'academia-tutor-onboarding-docs',
  false
)
on conflict (id) do update
set
  name = excluded.name,
  public = false;
