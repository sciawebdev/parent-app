-- 1. Create a private schema to hold the helper function
create schema if not exists private;

-- 2. Create the helper function to get a claim from the JWT
create or replace function private.get_my_claim(claim text)
returns jsonb
language sql stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> claim, null)::jsonb;
$$;

-- 3. Create the RLS policy for admins
create policy "Allow admins to insert into scheduled_notifications"
on public.scheduled_notifications
for insert to authenticated
with check (
  private.get_my_claim('user_role')::text = '"admin"'
);

-- 4. Also allow admins to view the scheduled notifications
create policy "Allow admins to view scheduled_notifications"
on public.scheduled_notifications
for select to authenticated
using (
  private.get_my_claim('user_role')::text = '"admin"'
); 