-- Atomic scoring finalization.
-- The Edge Function computes scoring from the private key, then this function
-- records the terminal state and immutable result under the locked attempt row.
create or replace function public.finalize_assessment_attempt_result(
  p_attempt_id uuid,
  p_student_id text,
  p_score integer,
  p_max_score integer,
  p_answered_count integer,
  p_submitted_at timestamptz,
  p_scored_at timestamptz
)
returns public.assessment_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.assessment_attempts;
  v_result public.assessment_results;
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt_id and student_id = p_student_id
  for update;

  if not found then raise exception 'ASSESSMENT_ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ASSESSMENT_ATTEMPT_NOT_ACTIVE'; end if;
  if v_attempt.expires_at is not null and p_submitted_at >= v_attempt.expires_at then raise exception 'ASSESSMENT_ATTEMPT_EXPIRED'; end if;
  if p_score < 0 or p_max_score <= 0 or p_score > p_max_score then raise exception 'ASSESSMENT_SCORE_INVALID'; end if;
  if p_answered_count < 0 or p_answered_count > jsonb_array_length(v_attempt.question_ids) then raise exception 'ASSESSMENT_ANSWER_COUNT_INVALID'; end if;

  update public.assessment_attempts
  set status='submitted', score=p_score, max_score=p_max_score,
      submitted_at=p_submitted_at, scored_at=p_scored_at, updated_at=now()
  where id=p_attempt_id;

  insert into public.assessment_results (
    student_id, attempt_id, course_id, assessment_id, domain,
    score, max_score, answered_count, submitted_at, scored_at, is_mock
  ) values (
    p_student_id, p_attempt_id, v_attempt.course_id, v_attempt.assessment_id, v_attempt.domain,
    p_score, p_max_score, p_answered_count, p_submitted_at, p_scored_at, v_attempt.is_mock
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.finalize_assessment_attempt_result(uuid,text,integer,integer,integer,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_assessment_attempt_result(uuid,text,integer,integer,integer,timestamptz,timestamptz) to service_role;
