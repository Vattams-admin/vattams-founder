-- Server-authoritative result/review access.
-- Client roles cannot query assessment result/answer tables directly; Edge Functions
-- must verify Firebase identity and attempt ownership before returning review data.

create or replace function public.get_assessment_result(
  p_attempt_id uuid,
  p_student_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assessment_attempts;
  r public.assessment_results;
begin
  select * into a from public.assessment_attempts
    where id = p_attempt_id and student_id = p_student_id
    for share;
  if not found then
    raise exception 'ASSESSMENT_RESULT_NOT_FOUND';
  end if;
  if a.status <> 'submitted' then
    raise exception 'ASSESSMENT_RESULT_NOT_AVAILABLE';
  end if;

  select * into r from public.assessment_results
    where attempt_id = p_attempt_id and student_id = p_student_id;
  if not found then
    raise exception 'ASSESSMENT_RESULT_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'attempt_id', r.attempt_id,
    'student_id', r.student_id,
    'course_id', r.course_id,
    'assessment_id', r.assessment_id,
    'domain', r.domain,
    'score', r.score,
    'max_score', r.max_score,
    'answered_count', r.answered_count,
    'submitted_at', r.submitted_at,
    'scored_at', r.scored_at,
    'is_mock', r.is_mock
  );
end;
$$;

revoke all on function public.get_assessment_result(uuid,text) from public, anon, authenticated;
grant execute on function public.get_assessment_result(uuid,text) to service_role;
