DROP TRIGGER IF EXISTS on_new_notification ON public.scheduled_notifications;
DROP FUNCTION IF EXISTS public.handle_new_notification(); 