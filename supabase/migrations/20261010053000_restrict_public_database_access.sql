-- Supabase project hardening for the Academia runtime.
-- Firebase Auth/Firestore remain the application identity/data source; Supabase
-- is used by Academia for Storage and server-side Edge Functions. Public clients
-- must not read or mutate privileged service, payment, identity, OTP, or assessment
-- rows through PostgREST. service_role grants and RLS bypass are untouched.
--
-- Start from deny-by-default, including future objects created by postgres.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- Remove broad policies that currently expose or mutate cross-user records.
DROP POLICY IF EXISTS anon_all_ai_content_drafts ON public.ai_content_drafts;
DROP POLICY IF EXISTS anon_all_ai_conversations ON public.ai_conversations;
DROP POLICY IF EXISTS anon_all_analytics_snapshots ON public.analytics_snapshots;
DROP POLICY IF EXISTS anon_insert_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS anon_select_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS public_delete_bookings ON public.bookings;
DROP POLICY IF EXISTS public_select_bookings ON public.bookings;
DROP POLICY IF EXISTS public_update_bookings ON public.bookings;
DROP POLICY IF EXISTS public_insert_bookings ON public.bookings;
DROP POLICY IF EXISTS anon_all_chat_attachments ON public.chat_attachments;
DROP POLICY IF EXISTS public_delete_chat_messages ON public.chat_messages;
DROP POLICY IF EXISTS public_insert_chat_messages ON public.chat_messages;
DROP POLICY IF EXISTS public_select_chat_messages ON public.chat_messages;
DROP POLICY IF EXISTS public_update_chat_messages ON public.chat_messages;
DROP POLICY IF EXISTS anon_all_chat_typing ON public.chat_typing;
DROP POLICY IF EXISTS anon_all_complaints ON public.complaints;
DROP POLICY IF EXISTS anon_insert_redemptions ON public.coupon_redemptions;
DROP POLICY IF EXISTS anon_select_redemptions ON public.coupon_redemptions;
DROP POLICY IF EXISTS admin_all_coupons ON public.coupons;
DROP POLICY IF EXISTS anon_all_crm_reminders ON public.crm_reminders;
DROP POLICY IF EXISTS anon_select_customers ON public.customers;
DROP POLICY IF EXISTS anon_update_customers ON public.customers;
DROP POLICY IF EXISTS anon_all_fcm_tokens ON public.fcm_tokens;
DROP POLICY IF EXISTS public_delete_notifications ON public.notifications;
DROP POLICY IF EXISTS public_insert_notifications ON public.notifications;
DROP POLICY IF EXISTS public_select_notifications ON public.notifications;
DROP POLICY IF EXISTS public_update_notifications ON public.notifications;
DROP POLICY IF EXISTS anon_delete_otp ON public.otp_codes;
DROP POLICY IF EXISTS anon_insert_otp ON public.otp_codes;
DROP POLICY IF EXISTS anon_select_otp ON public.otp_codes;
DROP POLICY IF EXISTS anon_update_otp ON public.otp_codes;
DROP POLICY IF EXISTS public_delete_payments ON public.payments;
DROP POLICY IF EXISTS public_insert_payments ON public.payments;
DROP POLICY IF EXISTS public_select_payments ON public.payments;
DROP POLICY IF EXISTS public_update_payments ON public.payments;
DROP POLICY IF EXISTS public_delete_reviews ON public.reviews;
DROP POLICY IF EXISTS public_insert_reviews ON public.reviews;
DROP POLICY IF EXISTS public_update_reviews ON public.reviews;
DROP POLICY IF EXISTS admin_delete_service_categories ON public.service_categories;
DROP POLICY IF EXISTS admin_insert_service_categories ON public.service_categories;
DROP POLICY IF EXISTS admin_update_service_categories ON public.service_categories;
DROP POLICY IF EXISTS admin_delete_service_prices ON public.service_prices;
DROP POLICY IF EXISTS admin_insert_service_prices ON public.service_prices;
DROP POLICY IF EXISTS admin_update_service_prices ON public.service_prices;
DROP POLICY IF EXISTS public_delete_site_settings ON public.site_settings;
DROP POLICY IF EXISTS public_update_site_settings ON public.site_settings;
DROP POLICY IF EXISTS public_write_site_settings ON public.site_settings;
DROP POLICY IF EXISTS public_delete_support ON public.support_messages;
DROP POLICY IF EXISTS public_select_support ON public.support_messages;
DROP POLICY IF EXISTS public_update_support ON public.support_messages;
DROP POLICY IF EXISTS anon_delete_applications ON public.technician_applications;
DROP POLICY IF EXISTS anon_select_applications ON public.technician_applications;
DROP POLICY IF EXISTS anon_update_applications ON public.technician_applications;
DROP POLICY IF EXISTS anon_all_technician_attendance ON public.technician_attendance;
DROP POLICY IF EXISTS anon_all_technician_documents ON public.technician_documents;
DROP POLICY IF EXISTS anon_all_emergency_contacts ON public.technician_emergency_contacts;
DROP POLICY IF EXISTS public_delete_technician_jobs ON public.technician_jobs;
DROP POLICY IF EXISTS public_insert_technician_jobs ON public.technician_jobs;
DROP POLICY IF EXISTS public_select_technician_jobs ON public.technician_jobs;
DROP POLICY IF EXISTS public_update_technician_jobs ON public.technician_jobs;
DROP POLICY IF EXISTS anon_all_leave_requests ON public.technician_leave_requests;
DROP POLICY IF EXISTS public_delete_technician_notifications ON public.technician_notifications;
DROP POLICY IF EXISTS public_insert_technician_notifications ON public.technician_notifications;
DROP POLICY IF EXISTS public_select_technician_notifications ON public.technician_notifications;
DROP POLICY IF EXISTS public_update_technician_notifications ON public.technician_notifications;
DROP POLICY IF EXISTS anon_delete_training_videos ON public.technician_training_videos;
DROP POLICY IF EXISTS anon_insert_training_videos ON public.technician_training_videos;
DROP POLICY IF EXISTS anon_select_training_videos ON public.technician_training_videos;
DROP POLICY IF EXISTS anon_update_training_videos ON public.technician_training_videos;
DROP POLICY IF EXISTS public_delete_technicians ON public.technicians;
DROP POLICY IF EXISTS public_insert_technicians ON public.technicians;
DROP POLICY IF EXISTS public_select_technicians ON public.technicians;
DROP POLICY IF EXISTS public_update_technicians ON public.technicians;
DROP POLICY IF EXISTS public_delete_wallet_recharges ON public.wallet_recharges;
DROP POLICY IF EXISTS public_insert_wallet_recharges ON public.wallet_recharges;
DROP POLICY IF EXISTS public_select_wallet_recharges ON public.wallet_recharges;
DROP POLICY IF EXISTS public_update_wallet_recharges ON public.wallet_recharges;
DROP POLICY IF EXISTS public_delete_wallet_settings ON public.wallet_settings;
DROP POLICY IF EXISTS public_insert_wallet_settings ON public.wallet_settings;
DROP POLICY IF EXISTS public_select_wallet_settings ON public.wallet_settings;
DROP POLICY IF EXISTS public_update_wallet_settings ON public.wallet_settings;
DROP POLICY IF EXISTS public_delete_wallet_transactions ON public.wallet_transactions;
DROP POLICY IF EXISTS public_insert_wallet_transactions ON public.wallet_transactions;
DROP POLICY IF EXISTS public_select_wallet_transactions ON public.wallet_transactions;
DROP POLICY IF EXISTS public_update_wallet_transactions ON public.wallet_transactions;
DROP POLICY IF EXISTS public_insert_tuition_students ON public.tuition_students;
DROP POLICY IF EXISTS public_insert_tuition_tutors ON public.tuition_tutors;
DROP POLICY IF EXISTS public_select_published_tuition_materials ON public.tuition_course_materials;

-- Restore only the narrow public catalog reads needed for unauthenticated browsing.
GRANT SELECT ON public.courses, public.tuition_courses, public.service_categories,
  public.service_prices, public.site_settings, public.coupons, public.reviews,
  public.technician_training_videos TO anon, authenticated;

-- The table-level SELECT grants above are still constrained by these RLS policies.
-- Keep active coupons only; never let a public role manage coupon definitions.
CREATE POLICY public_read_active_training_videos ON public.technician_training_videos
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Customer-facing intake is insert-only. Sensitive rows are not readable or
-- editable after submission by an unauthenticated client.
GRANT INSERT ON public.customers, public.bookings, public.support_messages,
  public.complaints, public.technician_applications TO anon, authenticated;

-- A booking may only be created in its initial pending state. Clients cannot
-- assign a technician, set financial totals, write OTPs, or mark work completed.
CREATE POLICY public_insert_pending_bookings ON public.bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND assigned_technician_id IS NULL
    AND technician_notes IS NULL
    AND amount IS NULL
    AND base_price IS NULL
    AND gst_amount IS NULL
    AND platform_fee IS NULL
    AND commission_amount IS NULL
    AND total_amount IS NULL
    AND start_otp IS NULL
    AND complete_otp IS NULL
    AND otp_verified_at IS NULL
    AND job_started_at IS NULL
    AND job_completed_at IS NULL
    AND otp_verification_status = 'pending'
    AND job_duration_minutes IS NULL
    AND ai_booking IS NOT TRUE
    AND coupon_code IS NULL
    AND COALESCE(discount_amount, 0) = 0
    AND invoice_number IS NULL
    AND rescheduled_from IS NULL
  );

-- Safe public intake policies: no client can read the inbox or alter its status.
CREATE POLICY public_insert_support_intake ON public.support_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open' AND admin_response IS NULL);
CREATE POLICY public_insert_complaint_intake ON public.complaints
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open' AND admin_response IS NULL AND resolved_at IS NULL);
CREATE POLICY public_insert_technician_application ON public.technician_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (technician_id IS NULL AND profile_score = 0);

-- Firestore is the Academia source of truth for student/tutor registrations and
-- Supabase Storage is the material store; no direct public table grants remain
-- for payments, OTPs, wallets, technician PII, private course materials, or logs.
