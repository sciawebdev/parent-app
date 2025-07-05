DROP POLICY IF EXISTS "Allow admins to insert into scheduled_notifications" ON public.scheduled_notifications;
DROP POLICY IF EXISTS "Allow admins to view scheduled_notifications" ON public.scheduled_notifications;
DROP FUNCTION IF EXISTS private.get_my_claim;
DROP SCHEMA IF EXISTS private; 