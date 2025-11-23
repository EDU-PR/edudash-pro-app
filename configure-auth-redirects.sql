-- Configure Supabase Auth redirect URLs
-- Run this in Supabase SQL Editor

-- This updates the auth configuration to use the correct redirect URL
-- You also need to add these URLs in the Supabase Dashboard:
-- Authentication → URL Configuration → Redirect URLs

-- Add these URLs manually in the dashboard:
-- Production: https://edudashpro.org.za/reset-password
-- Local dev: http://localhost:3000/reset-password
-- Web app: https://edudashpro.vercel.app/reset-password (if you deploy to Vercel)

-- The email template will automatically use these configured URLs
-- when sending password reset emails

-- For now, you can also send a custom email with the correct link:
