-- Harden the Mock Test competition access cache.
-- Firebase Auth remains identity-only.
-- Firestore is not used by the Mock Test runtime.

create index if not exists competition_access_cache_checked_at_idx
  on public.competition_access_cache (checked_at);

create index if not exists competition_access_cache_course_idx
  on public.competition_access_cache (course_id);

alter table public.competition_access_cache
  drop constraint if exists competition_access_cache_valid_flags;

alter table public.competition_access_cache
  add constraint competition_access_cache_valid_flags
  check (
    is_admin = true
    or enrolment_active = true
  );

alter table public.competition_access_cache
  drop constraint if exists competition_access_cache_valid_dob;

alter table public.competition_access_cache
  add constraint competition_access_cache_valid_dob
  check (
    date_of_birth is not null
  );

comment on table public.competition_access_cache is
  'Precomputed competition access for Mock Test runtime. Firebase Auth provides identity; Firestore is not queried by the Mock Test runtime.';
