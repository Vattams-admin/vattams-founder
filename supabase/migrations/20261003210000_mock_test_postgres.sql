-- Mock Test only.
-- Firebase Auth remains the identity provider.
-- Supabase Postgres becomes the data store.
-- Firestore is not used by the Mock Test flow.

create table if not exists public.competition_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  course_id text not null,
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

  constraint competition_mock_attempts_status_check
    check (status in ('in_progress', 'submitted'))
);

create index if not exists idx_competition_mock_attempts_student
  on public.competition_mock_attempts (student_id);

create index if not exists idx_competition_mock_attempts_student_course_status
  on public.competition_mock_attempts (student_id, course_id, status);

create table if not exists public.competition_mock_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.competition_mock_attempts(id)
    on delete cascade,
  question_id text not null,
  answer text not null default '',
  updated_at timestamptz not null default now(),

  constraint competition_mock_answers_attempt_question_unique
    unique (attempt_id, question_id)
);

create index if not exists idx_competition_mock_answers_attempt
  on public.competition_mock_answers (attempt_id);

create table if not exists public.competition_mock_results (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  attempt_id uuid not null
    references public.competition_mock_attempts(id)
    on delete cascade,
  course_id text not null,
  score integer not null,
  max_score integer not null,
  answered_count integer not null,
  submitted_at timestamptz not null,
  scored_at timestamptz not null,
  is_mock boolean not null default true,
  created_at timestamptz not null default now(),

  constraint competition_mock_results_attempt_unique
    unique (attempt_id)
);

create index if not exists idx_competition_mock_results_student
  on public.competition_mock_results (student_id);

create index if not exists idx_competition_mock_results_student_course
  on public.competition_mock_results (student_id, course_id);

-- Firebase users are not Supabase Auth users.
-- Therefore client-side access is disabled.
-- Edge Functions will use the server key after verifying
-- the Firebase ID token.
alter table public.competition_mock_attempts enable row level security;
alter table public.competition_mock_answers enable row level security;
alter table public.competition_mock_results enable row level security;
