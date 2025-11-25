-- Set password for relebogilekgobe55@gmail.com
-- Password: Relebogile123@

-- First, find the user ID
SELECT id, email FROM auth.users WHERE email = 'relebogilekgobe55@gmail.com';

-- Update the password (Supabase will automatically hash it)
-- Run this in the Supabase SQL Editor:

UPDATE auth.users 
SET 
  encrypted_password = crypt('Relebogile123@', gen_salt('bf')),
  updated_at = now()
WHERE email = 'relebogilekgobe55@gmail.com';

-- Verify the update
SELECT id, email, updated_at, confirmed_at 
FROM auth.users 
WHERE email = 'relebogilekgobe55@gmail.com';
