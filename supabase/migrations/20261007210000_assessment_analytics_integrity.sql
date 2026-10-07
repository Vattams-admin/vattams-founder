-- Server-authoritative student assessment analytics.
-- Analytics derive only from immutable submitted results; in-progress attempts
-- and client-provided scores are never accepted.

create or replace function public.get_assessment_analytics(
  p_student_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_completed integer;
  v_score integer;
  v_max integer;
  v_accuracy numeric;
  v_items jsonb;
begin
  select count(*), count(*) filter (where status = 'submitted'),
         coalesce(sum(score) filter (where status = 'submitted'), 0),
         coalesce(sum(max_score) filter (where status = 'submitted'), 0)
    into v_total, v_completed, v_score, v_max
    from public.assessment_attempts
    where student_id = p_student_id;

  if v_max > 0 then
    v_accuracy := round((v_score::numeric / v_max::numeric) * 100, 2);
  else
    v_accuracy := 0;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'assessment_id', assessment_id,
      'attempt_count', count(*),
      'best_score', max(score),
      'best_max_score', (array_agg(max_score order by score desc))[1],
      'last_submitted_at', max(submitted_at)
    ) order by max(submitted_at) desc
  ), '[]'::jsonb)
    into v_items
    from public.assessment_results
    where student_id = p_student_id
    group by assessment_id;

  return jsonb_build_object(
    'total_attempts', v_total,
    'completed_attempts', v_completed,
    'total_score', v_score,
    'total_max_score', v_max,
    'accuracy_percent', v_accuracy,
    'assessments', v_items
  );
end;
$$;

revoke all on function public.get_assessment_analytics(text) from public, anon, authenticated;
grant execute on function public.get_assessment_analytics(text) to service_role;
