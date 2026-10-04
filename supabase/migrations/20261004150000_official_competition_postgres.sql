-- Official Competition runtime only.
-- Firebase Auth remains the identity provider.
-- Supabase Postgres stores official attempts, answers, and results.
-- Supabase Storage stores the official question/answer bundles.
-- Firestore is not used by the official competition runtime.

create table if not exists public.competition_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  course_id text not null,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  question_ids jsonb not null,
  score integer,
  max_score integer,
  submitted_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint competition_attempts_status_check
    check (status in ('in_progress', 'submitted'))
);

create index if not exists idx_competition_attempts_student
  on public.competition_attempts (student_id);

create index if not exists idx_competition_attempts_student_course_status
  on public.competition_attempts (student_id, course_id, status);

create table if not exists public.competition_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.competition_attempts(id)
    on delete cascade,
  question_id text not null,
  answer text not null default '',
  is_correct boolean,
  correct_answer text,
  correct_option_index integer,
  explanation text,
  marks_awarded integer,
  answered_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint competition_answers_attempt_question_unique
    unique (attempt_id, question_id)
);

create index if not exists idx_competition_answers_attempt
  on public.competition_answers (attempt_id);

create table if not exists public.competition_results (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  attempt_id uuid not null
    references public.competition_attempts(id)
    on delete cascade,
  course_id text not null,
  score integer not null,
  max_score integer not null,
  answered_count integer not null,
  submitted_at timestamptz not null,
  scored_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint competition_results_attempt_unique
    unique (attempt_id)
);

create index if not exists idx_competition_results_student
  on public.competition_results (student_id);

create index if not exists idx_competition_results_student_course
  on public.competition_results (student_id, course_id);

alter table public.competition_attempts enable row level security;
alter table public.competition_answers enable row level security;
alter table public.competition_results enable row level security;

revoke all on public.competition_attempts from anon, authenticated;
revoke all on public.competition_answers from anon, authenticated;
revoke all on public.competition_results from anon, authenticated;

grant all on public.competition_attempts to service_role;
grant all on public.competition_answers to service_role;
grant all on public.competition_results to service_role;

-- Prevent concurrent duplicate active official attempts.
create unique index if not exists competition_one_active_attempt
  on public.competition_attempts (student_id, course_id)
  where status = 'in_progress';
