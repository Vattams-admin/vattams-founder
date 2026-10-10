-- Pin search_path for remaining trigger functions flagged by Supabase's
-- security advisor. These functions are not SECURITY DEFINER; behavior is
-- unchanged, but name resolution is explicit and pg_temp is last.

ALTER FUNCTION public.assign_student_id()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assign_technician_employee_id()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.assign_tutor_employee_id()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.compute_tuition_tutor_registration_fee()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_notifications_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_service_prices_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_tuition_course_materials_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_tuition_students_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_tuition_tutors_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
