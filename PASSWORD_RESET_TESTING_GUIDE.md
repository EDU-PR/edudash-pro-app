# Password Reset Testing Guide

## Current Configuration

### Supabase Auth Settings
- **Site URL**: `https://edudashpro.org.za`
- **Redirect URLs**: ✅ Already configured with all necessary URLs

## Testing the Password Reset Flow

### 1. Request Password Reset
1. Go to https://edudashpro.org.za/forgot-password
2. Enter email address: `dipsroboticsgm@gmail.com`
3. Click "Send Reset Link"
4. Check email inbox

### 2. Click Reset Link
The email contains a link like:
```
https://lvvvjywrmpcqrpvuptdi.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://edudashpro.org.za
```

**What happens:**
1. Supabase processes the token server-side
2. Creates a recovery session
3. Redirects to Site URL (`https://edudashpro.org.za`)
4. **Our middleware intercepts** and checks for recovery session
5. Redirects to `/reset-password` page

### 3. Reset Password
1. Should land on `/reset-password` page
2. Enter new password (min 8 characters)
3. Confirm password
4. Click "Reset Password"
5. Should see success message
6. Auto-redirect to `/sign-in` after 3 seconds

### 4. Sign In with New Password
1. Enter email and new password
2. Click "Sign In"
3. Should redirect to appropriate dashboard

## Troubleshooting

### Issue: Redirects to homepage instead of reset-password
**Solution**: 
- Middleware update (just deployed) now detects recovery sessions
- Even if Supabase redirects to homepage, middleware will catch it and redirect to `/reset-password`

### Issue: "Invalid or expired reset link"
**Possible causes**:
- Link is older than 24 hours
- Link was already used
- User manually changed password through another method

**Solution**: Request a new password reset

### Issue: Email not received
**Check**:
1. Spam/junk folder
2. Email template uploaded to Supabase (Auth → Templates)
3. SMTP settings in Supabase

## Middleware Logic

The updated middleware (`web/src/middleware.ts`) now handles:

1. **Direct token links**: `?token_hash=xxx&type=recovery`
   - Redirects to `/reset-password` with params

2. **Recovery sessions**: After Supabase processes token
   - Detects user has `recovery_sent_at` flag
   - Redirects from homepage to `/reset-password`

3. **Auth errors**: `?error=xxx&error_description=xxx`
   - Redirects to `/sign-in` with error messages

4. **Loop prevention**: Skips redirect if already on `/reset-password`

## Recent Deployments

- **Latest**: Improved middleware with recovery session detection
- **Previous**: Initial middleware + TypeScript fixes + payment tracking

Check deployment status:
```bash
cd /home/king/Desktop/edudashpro/web && vercel ls | head -5
```

## Manual Testing Checklist

- [ ] Email arrives within 2 minutes
- [ ] Email template looks professional (gradients, proper formatting)
- [ ] Reset button is clickable
- [ ] Link redirects to `/reset-password` page (not homepage)
- [ ] Token is automatically detected
- [ ] Email address shows on reset password page
- [ ] Password validation works (min 8 chars)
- [ ] Passwords must match
- [ ] Success message shows after reset
- [ ] Auto-redirect to sign-in works
- [ ] Can sign in with new password
- [ ] Dashboard loads correctly after sign-in

## Support

If issues persist:
1. Check Supabase logs: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/logs/explorer
2. Check Vercel deployment logs
3. Check browser console for errors (F12)
4. Verify Site URL in Supabase matches production domain
