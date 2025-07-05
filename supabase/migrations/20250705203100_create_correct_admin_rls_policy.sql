CREATE POLICY "Allow admins to manage scheduled_notifications"
ON public.scheduled_notifications
FOR ALL
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'); 