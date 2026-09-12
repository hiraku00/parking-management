-- Update Owner's auth_id after creating the owner account in Supabase Auth
-- Replace XXXXX with the actual auth user ID from Supabase Auth > Users

UPDATE public.profiles 
SET auth_id = 'XXXXX'
WHERE role = 'owner' AND full_name = 'Owner';

-- Verify the update
SELECT id, auth_id, full_name, role 
FROM public.profiles 
WHERE role = 'owner';
