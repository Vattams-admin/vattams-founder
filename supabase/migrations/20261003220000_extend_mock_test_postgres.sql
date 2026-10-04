-- Extend the existing Mock Test Postgres schema for the
-- Supabase-only Mock Test flow.
--
-- Do not modify the previous migration. This migration is incremental.

alter table public.competition_mock_attempts
  add column if not exists age_band text;

alter table public.competition_mock_answers
  add column if not exists is_correct boolean;

alter table public.competition_mock_answers
  add column if not exists correct_answer text;

alter table public.competition_mock_answers
  add column if not exists correct_option_index integer;

alter table public.competition_mock_answers
  add column if not exists explanation text;

alter table public.competition_mock_answers
  add column if not exists marks_awarded integer;

alter table public.competition_mock_answers
  add column if not exists answered_at timestamptz;

create table if not exists public.competition_access_cache (
  student_id       text not null,
  course_id        text not null,
  is_admin         boolean not null default false,
  enrolment_active boolean not null default false,
  date_of_birth    date,
  checked_at       timestamptz not null default now(),

  primary key (student_id, course_id)
);

alter table public.competition_access_cache enable row level security;

revoke all on public.competition_access_cache from anon, authenticated;

grant all on public.competition_access_cache to service_role;

-- Prevent concurrent duplicate active Mock Test attempts.
create unique index if not exists competition_mock_one_active_attempt
  on public.competition_mock_attempts (student_id, course_id)
  where status = 'in_progress';
