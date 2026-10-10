-- Harden SECURITY DEFINER routines in the shared Supabase project.
-- Client-facing roles must not invoke privileged RPCs directly.
-- Trigger/event-trigger functions remain attached to their triggers; PostgreSQL
-- does not require callers to hold EXECUTE when the trigger itself fires.
--
-- Trusted schemas precede pg_temp so temporary objects cannot shadow names
-- resolved by SECURITY DEFINER code. pg_catalog is first for built-ins.

ALTER FUNCTION public.admin_list_tuition_students(uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.admin_update_tuition_student_status(uuid, uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.decrement_technician_workload(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.finalize_assessment_attempt_result(uuid, text, integer, integer, integer, timestamptz, timestamptz)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_assessment_analytics(text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_assessment_history(text, integer, integer)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_assessment_result(uuid, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_assessment_topic_performance(text, text)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.increment_coupon_usage(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.lock_deposit_on_approval()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.persist_assessment_scored_answers(uuid, text, jsonb)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.process_booking_completion()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.process_recharge_approval()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.recalc_available_balance(uuid)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.save_assessment_attempt_answer(uuid, text, text, text, integer, timestamptz)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.transition_assessment_attempt_to_submitted(uuid, text, timestamptz)
  SET search_path = pg_catalog, public, pg_temp;

-- Keep the explicit service_role grants; remove inherited/default client access.
-- This covers the two legacy tuition RPCs, four legacy workload/coupon routines,
-- three trigger routines, and the automatic RLS event-trigger routine.
REVOKE EXECUTE ON FUNCTION public.admin_list_tuition_students(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_tuition_student_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_technician_workload(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_deposit_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_booking_completion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_recharge_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_available_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
