-- =====================================================================
-- VATTAMS ACADEMIA — Phase 2
-- RLS policies for public.academy_students and public.academy_tutors.
--
-- SCOPE: policies only. This file does NOT create either table — per
-- the Phase 2 brief, both already exist, created outside this repo. No
-- migration file for their CREATE TABLE could be found in this repo, so
-- their real column list could not be confirmed here (see
-- src/types/academy.ts for the assumed shape used by the frontend).
--
-- NOT YET APPLIED: no database connection is available in this
-- environment, so this file has not been run against Supabase. Review
-- column names against the real schema, then run it manually (Dashboard
-- SQL editor or `supabase db push`) before relying on it.
--
-- Reuses public.is_admin(), defined in 0001_init.sql — not redefined
-- here.
-- =====================================================================

alter table public.academy_students enable row level security;
alter table public.academy_tutors enable row level security;

-- ---------------------------------------------------------------------
-- ADMIN ACCESS
-- Same pattern as every other admin-managed table in this project:
-- full read/write gated on is_admin(), which checks the admin's
-- Supabase session against public.admins (see 0001_init.sql and
-- src/pages/admin/AdminLogin.tsx for how that Supabase session is
-- established for an admin — students/tutors never get one).
-- ---------------------------------------------------------------------

create policy "academy_students admin full access" on public.academy_students
  for all using (public.is_admin()) with check (public.is_admin());

create policy "academy_tutors admin full access" on public.academy_tutors
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- REGISTRATION INSERT (anon)
--
-- IMPORTANT CAVEAT — read before relying on this:
-- Students and tutors authenticate via Firebase, never Supabase Auth, so
-- there is no Supabase session (`auth.uid()`) for this project to check
-- an insert against. The policies below can only prevent a *duplicate*
-- firebase_uid; they CANNOT verify that the firebase_uid being inserted
-- actually belongs to the caller, because Postgres has no way to
-- validate a Firebase ID token. Anyone with the public anon key can
-- currently insert (or overwrite, via the app's upsert) a row claiming
-- any firebase_uid.
--
-- This mirrors a structural gap already flagged in the Phase 1 audit
-- (no server-side verification bridges Firebase identity into
-- Supabase). Closing it properly needs a Supabase Edge Function that
-- verifies the Firebase ID token server-side before writing — not a
-- direct client insert. Flagging this rather than quietly shipping a
-- broad "anyone can write anything" policy, per the instruction not to
-- weaken security with broad policies.
-- ---------------------------------------------------------------------

create policy "academy_students self insert by firebase_uid" on public.academy_students
  for insert
  with check (
    firebase_uid is not null
    and firebase_uid <> ''
  );

create policy "academy_students self update by firebase_uid" on public.academy_students
  for update
  using (true)
  with check (firebase_uid is not null and firebase_uid <> '');

create policy "academy_tutors self insert by firebase_uid" on public.academy_tutors
  for insert
  with check (
    firebase_uid is not null
    and firebase_uid <> ''
  );

create policy "academy_tutors self update by firebase_uid pending only" on public.academy_tutors
  for update
  using (approval_status = 'pending' or approval_status is null)
  with check (approval_status = 'pending' or approval_status is null);

-- No public SELECT policy is added for either table: students/tutors
-- reading their own row would need a real identity check, which (per
-- the caveat above) this project cannot yet perform against a Firebase
-- UID. Only admins can read academy_students / academy_tutors for now.
