-- Atomic answer persistence: an answer can only be written while its attempt is active and unexpired.
create or replace function public.save_assessment_attempt_answer(
  p_attempt_id uuid,
  p_student_id text,
  p_question_id text,
  p_answer text,
  p_selected_option_index integer,
  p_answered_at timestamptz default now()
)
returns public.assessment_answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer public.assessment_answers;
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt_id
    and student_id = p_student_id
  for update;

  if not found then raise exception 'ASSESSMENT_ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status <> 'in_progress' then raise exception 'ASSESSMENT_ATTEMPT_NOT_ACTIVE'; end if;
  if v_attempt.expires_at is not null and p_answered_at >= v_attempt.expires_at then raise exception 'ASSESSMENT_ATTEMPT_EXPIRED'; end if;

  if not exists (
    select 1 from jsonb_array_elements_text(v_attempt.question_ids) q(id)
    where q.id = p_question_id
  ) then raise exception 'ASSESSMENT_QUESTION_NOT_IN_ATTEMPT'; end if;

  insert into public.assessment_answers (
    attempt_id, question_id, answer, selected_option_index, answered_at, updated_at
  ) values (
    p_attempt_id, p_question_id, p_answer, p_selected_option_index, p_answered_at, now()
  )
  on conflict (attempt_id, question_id) do update
    set answer = excluded.answer,
        selected_option_index = excluded.selected_option_index,
        answered_at = excluded.answered_at,
        updated_at = now()
  returning * into v_answer;

  return v_answer;
end;
$$;

revoke all on function public.save_assessment_attempt_answer(uuid, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.save_assessment_attempt_answer(uuid, text, text, text, integer, timestamptz) to service_role;
