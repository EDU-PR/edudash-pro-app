# Fix Supabase Password Reset Redirect

## The Real Problem

The `redirect_to` parameter in the email template doesn't work because Supabase uses the **Site URL** setting from the dashboard, not the `redirect_to` parameter.

## The Solution

Update the **Site URL** in Supabase Authentication settings:

### Steps:

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/auth/url-configuration

2. **Find "Site URL" field**

3. **Change it from:**
   ```
   https://edudashpro.org.za
   ```

4. **To:**
   ```
   https://edudashpro.org.za/reset-password
   ```

5. **Click Save**

6. **Send fresh password reset email** (run script below)

## After Updating Site URL

Run this to send a fresh email:

```bash
cd /home/king/Desktop/edudashpro
python3 << 'PYSCRIPT'
import json, urllib.request
url = 'https://lvvvjywrmpcqrpvuptdi.supabase.co/auth/v1/recover'
anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2dnZqeXdybXBjcXJwdnVwdGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMzc4MzgsImV4cCI6MjA2ODYxMzgzOH0.mjXejyRHPzEJfMlhW46TlYI0qw9mtoSRJZhGsCkuvd8'
req = urllib.request.Request(url, json.dumps({'email': 'dipsroboticsgm@gmail.com'}).encode(), {'apikey': anon, 'Authorization': f'Bearer {anon}', 'Content-Type': 'application/json'})
urllib.request.urlopen(req)
print('✅ Email sent! Click link to test.')
PYSCRIPT
```

## Test the Flow

1. Check email inbox
2. Click password reset link
3. Should redirect to `/reset-password` page ✅
4. Enter new password
5. Success!

## Why This Works

- Supabase password reset flow: `ConfirmationURL` → validates token → redirects to **Site URL**
- By setting Site URL to `/reset-password`, all password resets go there automatically
- No need for `redirect_to` parameter in template

## Alternative: Keep Site URL as Homepage

If you want to keep Site URL as homepage for other features, you MUST use the `redirectTo` option when **calling** the password reset API:

```javascript
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://edudashpro.org.za/reset-password',
})
```

This is set in the **forgot-password page**, not the email template.
