-- =====================================================================
-- VATTAMS ACADEMIA — Migration 0002
-- Competitive exam platform, question bank, assessment engine.
-- Depends on 0001_init.sql (students, admins, courses, is_admin()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- COMPETITIVE EXAMS (spec §7)
-- ---------------------------------------------------------------------

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null, -- e.g. TNPSC, UPSC, SSC, Banking, Railway, Police, Defence, Teaching
  description text,
  eligibility text,
  syllabus text,
  exam_pattern text,
  duration_minutes int,
  total_questions int,
  total_marks numeric(6,2),
  negative_marking numeric(4,2) default 0, -- marks deducted per wrong answer
  passing_criteria text,
  exam_fee numeric(10,2) not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exam_subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name text not null,
  weightage_marks numeric(6,2),
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- QUESTION BANK (spec §8) — reusable across exams, courses, competitions
-- ---------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_type text not null default 'mcq'
    check (question_type in ('mcq', 'multi_select', 'true_false', 'fill_blank', 'short_answer')),
  subject text,
  topic text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  explanation text,
  marks numeric(5,2) not null default 1,
  negative_marks numeric(5,2) not null default 0,
  tags text[],
  exam_id uuid references public.exams(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid references public.admins(id),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_exam_idx on public.questions(exam_id);
create index questions_course_idx on public.questions(course_id);
create index questions_subject_idx on public.questions(subject);
create index questions_tags_idx on public.questions using gin(tags);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- ASSESSMENT ENGINE (spec §9) — timed exams, practice tests, mock tests
-- ---------------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assessment_type text not null
    check (assessment_type in ('practice', 'mock', 'chapter_test', 'course_test', 'competitive_exam')),
  exam_id uuid references public.exams(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  duration_minutes int not null,
  total_questions int not null,
  negative_marking numeric(4,2) not null default 0,
  randomize_questions boolean not null default true,
  show_instant_results boolean not null default true,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  -- an assessment must belong to at least an exam or a course
  constraint assessment_has_owner check (exam_id is not null or course_id is not null)
);

-- Which questions belong to a fixed-form assessment. For randomized
-- assessments, this table can be left empty and questions selected at
-- attempt-start time from `questions` by subject/exam/difficulty — the
-- attempt snapshot below is what actually matters for scoring integrity.
create table public.assessment_questions (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order int not null default 0,
  primary key (assessment_id, question_id)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted', 'abandoned')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  -- snapshotted at start so later edits to the question bank never change
  -- a student's already-taken test.
  question_snapshot jsonb not null default '[]',
  score numeric(6,2),
  total_marks numeric(6,2),
  accuracy numeric(5,2),
  rank int
);

create index assessment_attempts_student_idx on public.assessment_attempts(student_id);
create index assessment_attempts_assessment_idx on public.assessment_attempts(assessment_id);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_option_ids uuid[], -- for mcq/multi_select
  answer_text text,           -- for fill_blank/short_answer
  is_marked_for_review boolean not null default false,
  is_correct boolean,
  marks_awarded numeric(5,2),
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.exams enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;

-- Exams: public read if published (browsing works without login, like courses).
create policy "exams public read published" on public.exams
  for select using (is_published = true or public.is_admin());
create policy "exams admin write" on public.exams
  for all using (public.is_admin()) with check (public.is_admin());

create policy "exam_subjects public read" on public.exam_subjects for select using (true);
create policy "exam_subjects admin write" on public.exam_subjects for all using (public.is_admin()) with check (public.is_admin());

-- Questions and options are NEVER publicly readable — leaking these
-- defeats every test built on top of them. Only admins can read/write
-- directly; students only ever see questions via the attempt snapshot,
-- never the raw table.
create policy "questions admin only" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "question_options admin only" on public.question_options
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assessments public read published" on public.assessments
  for select using (is_published = true or public.is_admin());
create policy "assessments admin write" on public.assessments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assessment_questions admin only" on public.assessment_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Attempts: a student can create/read their own; only the owning student
-- can update it while in progress (to submit); admins read all for
-- grading/leaderboard purposes.
create policy "attempts read own" on public.assessment_attempts
  for select using (auth.uid() = student_id or public.is_admin());
create policy "attempts insert own" on public.assessment_attempts
  for insert with check (auth.uid() = student_id);
create policy "attempts update own in progress" on public.assessment_attempts
  for update using (auth.uid() = student_id and status = 'in_progress');

create policy "answers read own" on public.assessment_answers
  for select using (
    exists (select 1 from public.assessment_attempts a where a.id = attempt_id and (a.student_id = auth.uid() or public.is_admin()))
  );
create policy "answers write own in progress" on public.assessment_answers
  for all using (
    exists (select 1 from public.assessment_attempts a where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'in_progress')
  ) with check (
    exists (select 1 from public.assessment_attempts a where a.id = attempt_id and a.student_id = auth.uid() and a.status = 'in_progress')
  );

-- ---------------------------------------------------------------------
-- SCORING
-- Runs server-side on submit so a client can never fabricate a score.
-- Called by the frontend as: select public.submit_attempt('<attempt_id>');
-- ---------------------------------------------------------------------

create or replace function public.submit_attempt(p_attempt_id uuid)
returns public.assessment_attempts
language plpgsql
security definer
as $$
declare
  v_attempt public.assessment_attempts;
  v_total_marks numeric(6,2) := 0;
  v_score numeric(6,2) := 0;
  v_correct_count int := 0;
  v_answered_count int := 0;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and student_id = auth.uid() and status = 'in_progress'
    for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found, not yours, or already submitted';
  end if;

  -- Grade each answer against the question bank's correct option(s).
  -- This only handles mcq/multi_select automatically; short_answer
  -- questions are left ungraded (marks_awarded null) for manual review.
  update public.assessment_answers ans
  set
    is_correct = (
      case when q.question_type in ('mcq', 'true_false') then
        ans.selected_option_ids = array(
          select id from public.question_options o where o.question_id = q.id and o.is_correct = true
        )
      when q.question_type = 'multi_select' then
        ans.selected_option_ids::text[] = array(
          select id::text from public.question_options o where o.question_id = q.id and o.is_correct = true order by id
        )
      else null
      end
    ),
    marks_awarded = case
      when q.question_type in ('mcq', 'true_false', 'multi_select') then
        case when (
          case when q.question_type = 'multi_select' then
            ans.selected_option_ids::text[] = array(select id::text from public.question_options o where o.question_id = q.id and o.is_correct = true order by id)
          else
            ans.selected_option_ids = array(select id from public.question_options o where o.question_id = q.id and o.is_correct = true)
          end
        ) then q.marks else -1 * q.negative_marks end
      else marks_awarded
    end
  from public.questions q
  where q.id = ans.question_id and ans.attempt_id = p_attempt_id;

  select
    count(*) filter (where marks_awarded is not null),
    count(*) filter (where is_correct = true),
    coalesce(sum(marks_awarded), 0)
  into v_answered_count, v_correct_count, v_score
  from public.assessment_answers where attempt_id = p_attempt_id;

  select coalesce(sum(q.marks), 0) into v_total_marks
  from public.assessment_answers ans join public.questions q on q.id = ans.question_id
  where ans.attempt_id = p_attempt_id;

  update public.assessment_attempts
  set status = 'submitted',
      submitted_at = now(),
      score = v_score,
      total_marks = v_total_marks,
      accuracy = case when v_answered_count > 0 then round(100.0 * v_correct_count / v_answered_count, 2) else 0 end
  where id = p_attempt_id
  returning * into v_attempt;

  return v_attempt;
end;
$$;
