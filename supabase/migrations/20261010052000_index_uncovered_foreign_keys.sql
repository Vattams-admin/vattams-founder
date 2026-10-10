-- Add indexes for foreign keys identified by Supabase's performance advisor.
-- These indexes support joins and parent-row UPDATE/DELETE checks. IF NOT EXISTS
-- makes this migration safe if an equivalent index is added before deployment.

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
  ON public.admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_booking_id
  ON public.ai_conversations (created_booking_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_customer_id
  ON public.ai_conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_booking_id
  ON public.chat_attachments (booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message_id
  ON public.chat_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_complaints_booking_id
  ON public.complaints (booking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_customer_id
  ON public.complaints (customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_booking_id
  ON public.coupon_redemptions (booking_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id
  ON public.coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer_id
  ON public.coupon_redemptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_technician_applications_technician_id
  ON public.technician_applications (technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_documents_technician_id
  ON public.technician_documents (technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_emergency_contacts_technician_id
  ON public.technician_emergency_contacts (technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_jobs_booking_id
  ON public.technician_jobs (booking_id);
CREATE INDEX IF NOT EXISTS idx_technician_leave_requests_technician_id
  ON public.technician_leave_requests (technician_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_booking_id
  ON public.wallet_transactions (booking_id);
