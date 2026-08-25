-- =====================================================================
-- Admin authorization for Firebase-authenticated admin logins.
--
-- BACKGROUND: src/lib/adminData.ts has always queried a table called
-- `public.admin_users` (columns: email, full_name, role, is_active) to
-- decide whether a Firebase-authenticated user is an admin. That table
-- was never created by any migration in this repo — the only admin
-- table that exists is `public.admins` (0001_init.sql), which has a
-- different shape (id references auth.users, no email/is_active
-- columns) and whose RLS policy depends on `auth.uid()`, i.e. an active
-- Supabase Auth session. Since admin login here is Firebase-only, that
-- session never exists, so `admins` cannot be used for this flow.
--
-- This migration creates the table the frontend has been assuming all
-- along, matching src/lib/adminData.ts's AdminProfile shape.
--
-- SECURITY NOTE: rather than adding a permissive RLS SELECT policy that
-- would let the public anon key read every admin's email and full name,
-- this table has RLS enabled with NO select policy at all. Lookups go
-- through get_admin_profile_by_email() below, a SECURITY DEFINER
-- function that returns a row only for the one matching, active email
-- passed in — it never exposes the rest of the admin roster.
-- =====================================================================

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin', 'instructor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Intentionally no policies: nothing can SELECT/INSERT/UPDATE/DELETE
-- this table directly via the anon or authenticated Postgrest roles.
-- All access goes through the SECURITY DEFINER function below, which
-- runs as the function owner and bypasses RLS for its own query.

create or replace function public.get_admin_profile_by_email(p_email text)
returns table (
  id uuid,
  full_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.full_name, a.role, a.created_at
  from public.admin_users a
  where a.is_active = true
    and lower(a.email) = lower(trim(p_email))
  limit 1;
$$;

-- Lock the function down explicitly, then grant only what's needed:
-- anon (used before any session exists) and authenticated can call it,
-- but cannot query admin_users directly (no table grants given).
revoke all on function public.get_admin_profile_by_email(text) from public;
grant execute on function public.get_admin_profile_by_email(text) to anon, authenticated;

-- Seed the existing admin account referenced in AdminLogin.tsx / the
-- Firebase project (admin@vattams.net already exists in Firebase Auth;
-- this row is what grants that account admin authorization here).
-- Adjust full_name/role as appropriate before running in production.
insert into public.admin_users (email, full_name, role, is_active)
values ('admin@vattams.net', 'Admin', 'super_admin', true)
on conflict (email) do nothing;