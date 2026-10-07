-- Server-owned integrity commitment for the immutable attempt question/option snapshot.
alter table public.assessment_attempts
  add column if not exists integrity_sha256 text;

create index if not exists idx_assessment_attempts_integrity
  on public.assessment_attempts (id, integrity_sha256);

comment on column public.assessment_attempts.integrity_sha256 is
  'SHA-256 commitment over release pins, selected question IDs, and private option permutation.';
