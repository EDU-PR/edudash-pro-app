To fix the password reset issue:

## Step 1: Add Redirect URLs in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/auth/url-configuration
2. Under "Redirect URLs", add:
   - http://localhost:3000/reset-password
   - https://edudashpro.org.za/reset-password
3. Click "Save"

## Step 2: Update Email Template (Optional but recommended)

1. Go to: Authentication → Email Templates
2. Select "Reset Password (Change)" template  
3. Find the confirmation URL and make sure it uses: {{ .SiteURL }}/reset-password

## Step 3: Resend Password Reset

From Supabase Dashboard:
1. Go to Authentication → Users
2. Find: dipsroboticsgm@gmail.com
3. Click ⋮ (three dots) → "Send password recovery email"

The email will now redirect to the correct reset password page!

## Alternative: Send custom email with proper template

You can also use our custom parent approval email which includes the nice branding.
