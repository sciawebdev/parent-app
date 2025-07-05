UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL; 