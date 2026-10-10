-- Concurrency-safe state transitions for assessment attempts.
-- The state machine is intentionally narrow: in_progress -> submitted only.
create or replace function public.transition_assessment_attempt_to_submitted(
  p_attempt_id uuid,
  p_student_id text,
  p_submitted_at timestamptz default now()
)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.assessment_attempts;
begin
  update public.assessment_attempts
  set status = 'submitted',
      submitted_at = p_submitted_at,
      updated_at = now()
  where id = p_attempt_id
    and student_id = p_student_id
    and status = 'in_progress'
    and (expires_at is null or p_submitted_at < expires_at)
  returning * into v_attempt;

  if not found then
    raise exception 'ASSESSMENT_ATTEMPT_NOT_TRANSITIONABLE';
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.transition_assessment_attempt_to_submitted(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.transition_assessment_attempt_to_submitted(uuid, text, timestamptz) to service_role;

comment on function public.transition_assessment_attempt_to_submitted(uuid, text, timestamptz)
is 'Atomic in_progress -> submitted transition. Rejects duplicate/racing submissions and expired attempts.';
