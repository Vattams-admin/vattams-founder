-- Bind every assessment attempt to the exact production release it started with.
-- Existing attempts are backfilled only when their registry release is available at migration time.
alter table public.assessment_attempts
  add column if not exists release_version text,
  add column if not exists release_public_sha256 text,
  add column if not exists release_private_sha256 text;

create index if not exists idx_assessment_attempts_release
  on public.assessment_attempts (assessment_id, release_version);

comment on column public.assessment_attempts.release_version is
  'Immutable assessment release version captured when the attempt starts.';
comment on column public.assessment_attempts.release_public_sha256 is
  'Canonical SHA-256 of the public question bank captured when the attempt starts.';
comment on column public.assessment_attempts.release_private_sha256 is
  'Canonical SHA-256 of the private answer key captured when the attempt starts.';
