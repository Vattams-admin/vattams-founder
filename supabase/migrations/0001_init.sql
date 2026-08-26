-- =====================================================================
-- VATTAMS ACADEMIA — Initial schema (Phase 1: core vertical slice)
-- Covers: identity, catalogue, enrolment, payments, certificates.
-- Exam/question-bank/competition tables are stubbed with TODO markers
-- for the next migration pass — do not treat this file as the full
-- 70-phase schema, it is the load-bearing subset the app runs on.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- IDENTITY
-- Students authenticate via Supabase Auth; this table extends auth.users
-- with profile data. Admins are a separate, explicitly-provisioned role
-- table — never inferred from a claim in the JWT alone.
-- ---------------------------------------------------------------------

create table public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  mobile text,
  city text,
  state text,
  country text default 'India',
  education text,
  preferred_subjects text[],
  profile_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin', 'instructor')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CATALOGUE
-- ---------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  level text check (level in ('beginner', 'intermediate', 'advanced', 'professional')),
  duration_text text,
  instructor_name text,
  cover_image_url text,
  preview_video_url text,
  -- Pricing lives in the database, never hardcoded in the UI (spec section 19/45).
  base_fee numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  is_free boolean not null default false,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Computed final price — always derived, never stored as a separate
-- hand-edited column, so admin price changes propagate everywhere.
create or replace view public.course_pricing as
select
  id as course_id,
  base_fee,
  discount_amount,
  greatest(base_fee - discount_amount, 0) as final_price,
  is_free
from public.courses;

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  video_url text,
  pdf_url text,
  content text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- ENROLMENT + PROGRESS
-- ---------------------------------------------------------------------

create table public.course_enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  enrolled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table public.course_progress (
  id uuid primary key default gen_random_uuid(),
  enrolment_id uuid not null references public.course_enrolments(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds int default 0,
  updated_at timestamptz not null default now(),
  unique (enrolment_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- PAYMENTS (UPI collect + manual UTR verification, per spec section 18/20)
-- ---------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'approved', 'rejected')),
  utr_reference text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.admins(id),
  admin_notes text,
  created_at timestamptz not null default now()
);

create index payments_status_idx on public.payments(status);
create index payments_student_idx on public.payments(student_id);

-- ---------------------------------------------------------------------
-- CERTIFICATES
-- ---------------------------------------------------------------------

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid references public.courses(id),
  certificate_type text not null check (certificate_type in ('course_completion', 'competition', 'achievement', 'assessment')),
  score numeric(5,2),
  issued_at timestamptz not null default now(),
  is_valid boolean not null default true
);

create index certificates_code_idx on public.certificates(certificate_code);

-- =====================================================================
-- TODO (next migration pass): exams, exam_subjects, questions,
-- question_options, assessments, assessment_attempts,
-- assessment_answers, competitions, competition_participants,
-- competition_results, assignments, assignment_submissions,
-- materials, notifications, student_notifications, audit_logs,
-- site_settings. Not included here so this slice stays reviewable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Default posture: locked. Every table gets an explicit policy —
-- nothing is readable/writable by default.
-- ---------------------------------------------------------------------

alter table public.students enable row level security;
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.course_progress enable row level security;
alter table public.payments enable row level security;
alter table public.certificates enable row level security;

-- Helper: is the current JWT user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- students: a student can read/update their own row; admins can read all.
create policy "students read own" on public.students
  for select using (auth.uid() = id or public.is_admin());
create policy "students update own" on public.students
  for update using (auth.uid() = id);
create policy "students insert own" on public.students
  for insert with check (auth.uid() = id);

-- admins table: only admins can read it (no public admin directory).
create policy "admins read self or peers" on public.admins
  for select using (public.is_admin());

-- catalogue is public read (course browsing works without login, spec section 4);
-- writes are admin-only.
create policy "categories public read" on public.categories for select using (true);
create policy "categories admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "courses public read published" on public.courses
  for select using (is_published = true or public.is_admin());
create policy "courses admin write" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "modules public read" on public.course_modules for select using (true);
create policy "modules admin write" on public.course_modules for all using (public.is_admin()) with check (public.is_admin());

-- lessons: only visible to enrolled students or admins — this is the
-- boundary that actually gates paid content, not the frontend route.
create policy "lessons enrolled read" on public.course_lessons
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.course_enrolments e
      join public.course_modules m on m.id = course_lessons.module_id
      where e.course_id = m.course_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "lessons admin write" on public.course_lessons for all using (public.is_admin()) with check (public.is_admin());

-- enrolments: student sees their own; admins see all; only admins can activate.
create policy "enrolments read own" on public.course_enrolments
  for select using (auth.uid() = student_id or public.is_admin());
create policy "enrolments insert own pending" on public.course_enrolments
  for insert with check (auth.uid() = student_id and status = 'pending');
create policy "enrolments admin update" on public.course_enrolments
  for update using (public.is_admin());

create policy "progress own" on public.course_progress
  for all using (
    exists (select 1 from public.course_enrolments e where e.id = enrolment_id and e.student_id = auth.uid())
  ) with check (
    exists (select 1 from public.course_enrolments e where e.id = enrolment_id and e.student_id = auth.uid())
  );

-- payments: a student can create/read their own pending payments and
-- submit a UTR; only an admin can move status to approved/rejected.
create policy "payments read own" on public.payments
  for select using (auth.uid() = student_id or public.is_admin());
create policy "payments insert own" on public.payments
  for insert with check (auth.uid() = student_id and status = 'pending');
create policy "payments submit utr own" on public.payments
  for update using (auth.uid() = student_id and status = 'pending')
  with check (status = 'submitted');
create policy "payments admin verify" on public.payments
  for update using (public.is_admin());

-- certificates: public verification is a *separate* read-only RPC
-- (see below) that exposes only non-sensitive fields — the table
-- itself is not publicly selectable to avoid leaking student rows.
create policy "certificates read own" on public.certificates
  for select using (auth.uid() = student_id or public.is_admin());
create policy "certificates admin write" on public.certificates
  for all using (public.is_admin()) with check (public.is_admin());

-- Public certificate verification (spec section 17): looks up by code
-- only, returns a minimal projection, no student contact info.
create or replace function public.verify_certificate(code text)
returns table (
  certificate_code text,
  student_name text,
  course_name text,
  certificate_type text,
  issued_at timestamptz,
  is_valid boolean
)
language sql
security definer
stable
as $$
  select c.certificate_code, s.full_name, co.name, c.certificate_type, c.issued_at, c.is_valid
  from public.certificates c
  join public.students s on s.id = c.student_id
  left join public.courses co on co.id = c.course_id
  where c.certificate_code = code;
$$;

-- ---------------------------------------------------------------------
-- ENROLMENT ACTIVATION TRIGGER
-- When an admin approves a payment, the matching enrolment is
-- activated automatically — this is the one place "access unlocks",
-- so it lives in the database, not scattered across frontend code.
-- ---------------------------------------------------------------------

create or replace function public.activate_enrolment_on_payment_approval()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.course_enrolments (student_id, course_id, status, enrolled_at)
    values (new.student_id, new.course_id, 'active', now())
    on conflict (student_id, course_id)
    do update set status = 'active', enrolled_at = now();
  end if;
  return new;
end;
$$;

create trigger trg_payment_approved
  after update on public.payments
  for each row
  execute function public.activate_enrolment_on_payment_approval();
