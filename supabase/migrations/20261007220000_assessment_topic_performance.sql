-- Authoritative topic performance from submitted answer records.
-- Only rows belonging to submitted attempts are considered. Topic metadata is read
-- from the registered public question bank by the Edge Function; this RPC only
-- aggregates persisted server-scored answers.

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
      coalesce((aa.answer ->> 'subject'), '') as subject,
      coalesce((aa.answer ->> 'topic'), '') as topic,
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
    group by a.assessment_id, coalesce((aa.answer ->> 'subject'), ''), coalesce((aa.answer ->> 'topic'), '')
  ) x;

  return v_items;
end;
$$;

revoke all on function public.get_assessment_topic_performance(text,text) from public, anon, authenticated;
grant execute on function public.get_assessment_topic_performance(text,text) to service_role;
