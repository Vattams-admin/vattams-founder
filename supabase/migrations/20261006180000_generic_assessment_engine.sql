-- Generic Assessment Engine.
-- Firebase Auth remains the identity provider.
-- Supabase Postgres stores executable assessment attempts/results.
-- Competition Mock tables remain unchanged and continue through their existing adapter.

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  course_id text not null,
  assessment_id text not null,
  domain text not null,
  kind text not null,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  question_ids jsonb not null,
  is_mock boolean not null default true,
  score integer,
  max_score integer,
  submitted_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assessment_attempts_status_check
    check (status in ('in_progress', 'submitted')),
  constraint assessment_attempts_domain_check
    check (domain in ('competition', 'competitive-exam', 'tuition')),
  constraint assessment_attempts_kind_check
    check (kind in (
      'topic_practice',
      'sectional_test',
      'pyq_test',
      'mock_test',
      'official_attempt',
      'chapter_test',
      'subject_test'
    ))
);

create index if not exists idx_assessment_attempts_student
  on public.assessment_attempts (student_id);

create index if not exists idx_assessment_attempts_student_assessment_status
  on public.assessment_attempts (student_id, assessment_id, status);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.assessment_attempts(id)
    on delete cascade,
  question_id text not null,
  answer text not null default '',
  selected_option_index integer,
  is_correct boolean,
  correct_option_index integer,
  explanation text,
  marks_awarded integer,
  answered_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint assessment_answers_attempt_question_unique
    unique (attempt_id, question_id),
  constraint assessment_answers_selected_option_check
    check (selected_option_index is null or selected_option_index between 0 and 3),
  constraint assessment_answers_correct_option_check
    check (correct_option_index is null or correct_option_index between 0 and 3)
);

create index if not exists idx_assessment_answers_attempt
  on public.assessment_answers (attempt_id);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  attempt_id uuid not null
    references public.assessment_attempts(id)
    on delete cascade,
  course_id text not null,
  assessment_id text not null,
  domain text not null,
  score integer not null,
  max_score integer not null,
  answered_count integer not null,
  submitted_at timestamptz not null,
  scored_at timestamptz not null,
  is_mock boolean not null default true,
  created_at timestamptz not null default now(),

  constraint assessment_results_attempt_unique
    unique (attempt_id),
  constraint assessment_results_domain_check
    check (domain in ('competition', 'competitive-exam', 'tuition'))
);

create index if not exists idx_assessment_results_student
  on public.assessment_results (student_id);

create index if not exists idx_assessment_results_student_assessment
  on public.assessment_results (student_id, assessment_id);

-- Cached access decision used by Edge Functions after Firebase identity verification.
-- Client access remains disabled; service_role performs reads/writes.
create table if not exists public.assessment_access_cache (
  student_id text not null,
  course_id text not null,
  assessment_id text not null,
  enrolment_active boolean not null default false,
  is_admin boolean not null default false,
  checked_at timestamptz not null default now(),
  primary key (student_id, course_id, assessment_id)
);

alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assessment_access_cache enable row level security;

revoke all on public.assessment_attempts from anon, authenticated;
revoke all on public.assessment_answers from anon, authenticated;
revoke all on public.assessment_results from anon, authenticated;
revoke all on public.assessment_access_cache from anon, authenticated;
