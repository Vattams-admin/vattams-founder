-- Immutable server-owned deadline for each assessment attempt.
alter table public.assessment_attempts
  add column if not exists expires_at timestamptz;

create index if not exists idx_assessment_attempts_expires
  on public.assessment_attempts (expires_at);

comment on column public.assessment_attempts.expires_at is
  'Server-computed immutable deadline snapshot from started_at plus the published assessment time limit.';
