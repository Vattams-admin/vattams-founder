-- Persist the exact option permutation used by each attempt.
-- The mapping is private server state and keeps scoring correct after option shuffling.
alter table public.assessment_attempts
  add column if not exists option_orders jsonb not null default '{}'::jsonb;

comment on column public.assessment_attempts.option_orders is
  'Private map question_id -> shuffled option index order for this attempt.';
