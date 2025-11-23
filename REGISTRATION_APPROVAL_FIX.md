# Registration Approval Fix - November 23, 2025

## Issues Identified

### 1. EduSitePro Admin Panel - Missing Sync Trigger
**Problem:** When admins approved registrations in EduSitePro, the approval only updated the database status but never triggered the sync to create parent accounts in EduDashPro.

**Impact:**
- Parents never received welcome emails
- No parent accounts were created
- Registration appeared approved but was incomplete

**Fixed in:** `/home/king/Desktop/edusitepro/src/app/dashboard/admin/registrations/[id]/page.tsx`

**Changes:**
- Added `fetch()` call to trigger `sync-registration-to-edudash` Edge Function
- Added better error handling and user feedback
- Confirmation message now explains what will happen (create account + send email)

### 2. Invalid Password Reset Links
**Problem:** The welcome email contained a generic password reset URL without the actual reset token.

**Impact:**
- Parents clicked "Set Your Password" but got redirected to generic page
- No way to actually set password
- Login credentials were invalid

**Fixed in:** `/home/king/Desktop/edudashpro/supabase/functions/sync-registration-to-edudash/index.ts`

**Changes:**
- Now properly captures the `action_link` from `generateLink()` response
- Passes the actual tokenized reset URL to the email template
- Email contains a working one-click password reset link

## Files Modified

### 1. `/home/king/Desktop/edusitepro/src/app/dashboard/admin/registrations/[id]/page.tsx`
```typescript
// BEFORE: Only updated status
const { error } = await supabase
  .from('registration_requests')
  .update({ status: 'approved', ... })
  .eq('id', registration.id);

// AFTER: Updates status + triggers sync
const { error } = await supabase
  .from('registration_requests')
  .update({ status: 'approved', ... })
  .eq('id', registration.id);

// Trigger sync to create parent account
const syncResponse = await fetch('https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registration-to-edudash', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon_key}` },
  body: JSON.stringify({ registration_id: registration.id }),
});
```

### 2. `/home/king/Desktop/edudashpro/supabase/functions/sync-registration-to-edudash/index.ts`
```typescript
// BEFORE: Generic URL (doesn't work)
const approvalEmail = generateParentApprovalEmail({
  resetPasswordUrl: 'https://edudashpro.org.za/reset-password', // ❌ No token!
  ...
});

// AFTER: Actual tokenized reset link
const { data: resetData } = await edudashClient.auth.admin.generateLink({
  type: 'recovery',
  email: normalizedEmail,
  options: { redirectTo: 'https://edudashpro.org.za/reset-password' },
});

const resetPasswordUrl = resetData?.properties?.action_link; // ✅ Has token!

const approvalEmail = generateParentApprovalEmail({
  resetPasswordUrl: resetPasswordUrl,
  ...
});
```

## Deployments

### Edge Function
```bash
supabase functions deploy sync-registration-to-edudash --project-ref lvvvjywrmpcqrpvuptdi
```
**Status:** ✅ Deployed successfully

### Next.js App (EduSitePro)
**Required:** Yes - Modified approval handler
**Files:** `src/app/dashboard/admin/registrations/[id]/page.tsx`

## Testing Checklist

- [ ] Approve registration in EduSitePro admin panel
  - [ ] Check database: `status` = 'approved' in `registration_requests`
  - [ ] Check database: `synced_to_edudash` = true
  - [ ] Check EduDashPro database: parent profile created
  - [ ] Check EduDashPro database: student record created
  
- [ ] Verify email sent to parent
  - [ ] Check parent's inbox for "Registration Approved" email
  - [ ] Click "Set Your Password" button
  - [ ] Should redirect to password reset page with token
  - [ ] Set new password successfully
  - [ ] Login with new credentials works

- [ ] Approve registration in EduDashPro principal panel (existing flow)
  - [ ] Same checks as above
  - [ ] Should still work as before

## Future Improvements

1. **Database Trigger:** Auto-sync when status changes to 'approved' (no manual trigger needed)
2. **Retry Logic:** If sync fails, queue for retry instead of failing silently
3. **Admin Notification:** Email principal when new parent account is created
4. **Audit Trail:** Log sync attempts and results for debugging

## Related Files

- `/home/king/Desktop/edudashpro/REGISTRATION_APPROVAL_FLOW.md` - Full approval workflow documentation
- `/home/king/Desktop/edudashpro/supabase/migrations/20251123000003_fix_principal_parent_view_no_recursion.sql` - RLS fix for viewing parent profiles
