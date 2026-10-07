-- Assessment lifecycle concurrency guard.
-- At most one active attempt may exist for a student/assessment.
-- Submitted attempts remain immutable history and are not affected.

create unique index if not exists uq_assessment_attempts_one_active
  on public.assessment_attempts (student_id, assessment_id)
  where status = 'in_progress';

comment on index public.uq_assessment_attempts_one_active is
  'Prevents concurrent duplicate active assessment attempts; submitted history remains allowed.';
