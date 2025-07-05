UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"user_role": "admin"}'
WHERE email = 'admin@admin.com'; 