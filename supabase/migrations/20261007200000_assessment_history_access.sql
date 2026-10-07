-- Student-scoped assessment history access.
-- The RPC returns only attempt/result summary fields; no answer rows, keys, hashes,
-- option permutations, or integrity metadata are exposed.

create or replace function public.get_assessment_history(
  p_student_id text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_items jsonb;
  v_total integer;
begin
  select count(*) into v_total
    from public.assessment_attempts
    where student_id = p_student_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'attempt_id', a.id,
      'assessment_id', a.assessment_id,
      'course_id', a.course_id,
      'domain', a.domain,
      'kind', a.kind,
      'status', a.status,
      'started_at', a.started_at,
      'submitted_at', a.submitted_at,
      'expires_at', case when a.status = 'in_progress' then a.expires_at else null end,
      'score', a.score,
      'max_score', a.max_score,
      'answered_count', case
        when a.status = 'submitted' then (
          select count(*) from public.assessment_answers aa
          where aa.attempt_id = a.id and aa.selected_option_index is not null
        )
        else null
      end
    ) order by a.started_at desc
  ), '[]'::jsonb) into v_items
  from (
    select *
    from public.assessment_attempts
    where student_id = p_student_id
    order by started_at desc
    limit v_limit offset v_offset
  ) a;

  return jsonb_build_object(
    'items', v_items,
    'limit', v_limit,
    'offset', v_offset,
    'total', v_total
  );
end;
$$;

revoke all on function public.get_assessment_history(text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_assessment_history(text,integer,integer) to service_role;
