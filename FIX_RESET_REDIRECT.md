## Fix Supabase Password Reset Redirect

The issue: Supabase is redirecting to `https://edudashpro.org.za` instead of `https://edudashpro.org.za/reset-password`

### Solution 1: Update Site URL in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/auth
2. Under "Site URL", set it to: `https://edudashpro.org.za/reset-password`
   - OR keep Site URL as `https://edudashpro.org.za` and configure redirects below

### Solution 2: Update Redirect URLs

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/auth/url-configuration
2. Under "Redirect URLs", add:
   - `https://edudashpro.org.za/reset-password`
   - `https://edudashpro.org.za/**` (wildcard for all paths)
   - `http://localhost:3000/reset-password` (for local dev)

### Solution 3: Update Password Recovery Settings

1. Go to Authentication → URL Configuration
2. Look for "Password Recovery Redirect URL" or similar setting
3. Set it to: `https://edudashpro.org.za/reset-password`

### Solution 4: Use Custom Email with Full Redirect URL

Instead of using {{ .ConfirmationURL }}, construct the URL manually with the correct redirect:

```
{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .SiteURL }}/reset-password
```

But the BEST solution is #2 - just add the redirect URLs to the allowlist!
