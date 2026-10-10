-- Remove the superseded unrestricted support-message INSERT policy.
-- The constrained public_insert_support_intake policy is the only public insert
-- path; permissive policies are ORed, so retaining the old TRUE check would
-- defeat the new status/admin_response constraints.
DROP POLICY IF EXISTS public_insert_support ON public.support_messages;
