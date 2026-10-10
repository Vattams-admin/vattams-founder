-- Authoritative topic performance from server-scored submitted answers.
alter table public.assessment_answers add column if not exists subject text;
alter table public.assessment_answers add column if not exists topic text;
alter table public.assessment_answers add column if not exists subtopic text;

create or replace function public.get_assessment_topic_performance(
  p_student_id text,
  p_assessment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'assessment_id', x.assessment_id,
      'subject', x.subject,
      'topic', x.topic,
      'attempted_questions', x.attempted_questions,
      'correct_questions', x.correct_questions,
      'accuracy_percent', x.accuracy_percent,
      'marks_awarded', x.marks_awarded
    ) order by x.accuracy_percent asc, x.attempted_questions desc
  ), '[]'::jsonb) into v_items
  from (
    select
      a.assessment_id,
      coalesce(aa.subject, '') as subject,
      coalesce(aa.topic, '') as topic,
      count(*) as attempted_questions,
      count(*) filter (where aa.is_correct = true) as correct_questions,
      round((count(*) filter (where aa.is_correct = true)::numeric / nullif(count(*),0)) * 100, 2) as accuracy_percent,
      coalesce(sum(aa.marks_awarded),0) as marks_awarded
    from public.assessment_answers aa
    join public.assessment_attempts a on a.id = aa.attempt_id
    where a.student_id = p_student_id
      and a.status = 'submitted'
      and aa.is_correct is not null
      and (p_assessment_id is null or a.assessment_id = p_assessment_id)
    group by a.assessment_id, coalesce(aa.subject, ''), coalesce(aa.topic, '')
  ) x;

  return v_items;
end;
$$;

revoke all on function public.get_assessment_topic_performance(text,text) from public, anon, authenticated;
grant execute on function public.get_assessment_topic_performance(text,text) to service_role;


create or replace function public.persist_assessment_scored_answers(
  p_attempt_id uuid,
  p_student_id text,
  p_rows jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assessment_attempts;
  row jsonb;
begin
  select * into a from public.assessment_attempts
    where id = p_attempt_id and student_id = p_student_id
    for update;
  if not found then raise exception 'ASSESSMENT_ATTEMPT_NOT_FOUND'; end if;
  if a.status <> 'in_progress' then raise exception 'ASSESSMENT_ATTEMPT_NOT_ACTIVE'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_SCORED_ANSWERS'; end if;

  for row in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.assessment_answers(
      attempt_id, question_id, answer, selected_option_index,
      is_correct, correct_option_index, explanation, marks_awarded,
      answered_at, updated_at, subject, topic, subtopic
    ) values (
      p_attempt_id,
      row->>'question_id',
      coalesce(row->>'answer',''),
      case when row ? 'selected_option_index' then (row->>'selected_option_index')::integer else null end,
      (row->>'is_correct')::boolean,
      (row->>'correct_option_index')::integer,
      row->>'explanation',
      (row->>'marks_awarded')::integer,
      coalesce((row->>'answered_at')::timestamptz, now()),
      now(),
      nullif(row->>'subject',''),
      nullif(row->>'topic',''),
      nullif(row->>'subtopic','')
    )
    on conflict (attempt_id, question_id) do update set
      answer=excluded.answer, selected_option_index=excluded.selected_option_index,
      is_correct=excluded.is_correct, correct_option_index=excluded.correct_option_index,
      explanation=excluded.explanation, marks_awarded=excluded.marks_awarded,
      answered_at=excluded.answered_at, updated_at=now(),
      subject=excluded.subject, topic=excluded.topic, subtopic=excluded.subtopic;
  end loop;
  return true;
end;
$$;

revoke all on function public.persist_assessment_scored_answers(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.persist_assessment_scored_answers(uuid,text,jsonb) to service_role;
