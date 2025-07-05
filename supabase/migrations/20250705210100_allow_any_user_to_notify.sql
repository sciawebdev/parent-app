CREATE POLICY "Allow any authenticated user to insert"
ON public.scheduled_notifications
FOR INSERT
TO authenticated
WITH CHECK (true); 