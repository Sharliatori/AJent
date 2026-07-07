-- Drop always-true anon write policies for report_recipients.
-- Writes are now handled by the manage-recipients edge function (service_role bypasses RLS).
DROP POLICY IF EXISTS "anon_insert_report_recipients" ON public.report_recipients;
DROP POLICY IF EXISTS "anon_update_report_recipients" ON public.report_recipients;
DROP POLICY IF EXISTS "anon_delete_report_recipients" ON public.report_recipients;
