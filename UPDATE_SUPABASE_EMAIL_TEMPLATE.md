# Update Supabase Email Template - REQUIRED

## The Problem
Your password reset emails are using Supabase's **default template** which doesn't include the custom `redirect_to` parameter. This is why users are being redirected to the homepage instead of `/reset-password`.

## The Solution
You MUST update the email template in your Supabase dashboard.

## Step-by-Step Instructions

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/auth/templates

### 2. Navigate to Email Templates
- Click **Authentication** in left sidebar
- Click **Email Templates**

### 3. Find "Reset Password" Template
Look for one of these:
- **"Reset Password"**
- **"Recovery"** 
- **"Magic Link"**

### 4. Replace the Template
- Click on the template to edit
- **DELETE ALL** existing HTML
- **COPY ALL** content from: `supabase-email-templates/reset-password-branded.html`
- **PASTE** into the template editor
- Click **Save**

### 5. Verify the Template
Look for this line in the saved template:
```html
<a href="{{ .ConfirmationURL }}&redirect_to=https%3A%2F%2Fedudashpro.org.za%2Freset-password"
```

If you see `&redirect_to=https%3A%2F%2Fedudashpro.org.za%2Freset-password` then it's correct! ✅

### 6. Send Fresh Email
After saving the template, send a NEW password reset email:
```bash
cd /home/king/Desktop/edudashpro
python3 << 'PYSCRIPT'
import json, urllib.request
url = 'https://lvvvjywrmpcqrpvuptdi.supabase.co/auth/v1/recover'
anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8'
req = urllib.request.Request(url, json.dumps({'email': 'dipsroboticsgm@gmail.com'}).encode(), {'apikey': anon_key, 'Authorization': f'Bearer {anon_key}', 'Content-Type': 'application/json'})
print('Sending fresh email...')
urllib.request.urlopen(req)
print('✅ Email sent! Check inbox.')
PYSCRIPT
```

### 7. Test the Flow
1. Check email inbox
2. Click the reset link
3. Should now redirect to `/reset-password` page
4. Enter new password
5. Submit

## Why This Happens
Supabase email templates are stored **server-side** in their dashboard, not in your codebase. The `redirect_to` parameter only works if it's included in the email template HTML.

## Current vs Fixed Flow

### ❌ Current (Default Template)
```
Email → Click link → Supabase validates → Redirects to Site URL (homepage)
```

### ✅ Fixed (Custom Template)
```
Email → Click link → Supabase validates → Redirects to /reset-password
```

## Need Help?
If you're still being redirected to homepage after updating template:
1. Make sure you clicked **Save** in Supabase dashboard
2. Send a **NEW** email (old emails use old template)
3. Check that Site URL is set to `https://edudashpro.org.za` (without /reset-password)
4. Verify the email HTML includes `&redirect_to=` parameter
