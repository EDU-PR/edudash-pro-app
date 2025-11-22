# Registration Sync Setup Guide

This guide explains how to set up the registration management and sync system between EduSitePro and EduDashPro.

## Overview

The Registration Management system allows SuperAdmins to:
- View all pending student registrations from all schools (stored in EduSitePro)
- Approve or reject registrations with real-time notifications
- Automatically sync approved registrations to EduDashPro database
- Send welcome emails to new parents with password setup instructions

## Architecture

```
EduSitePro DB (bppuzibjlxgfwrujzfsz.supabase.co)
  └── registration_requests table
       ├── Stores all student registrations
       └── Synced to EduDashPro on approval

EduDashPro Admin Panel
  ├── /admin/registrations (review page)
  ├── RegistrationNotifications (bell icon)
  └── Edge Function: sync-registration-to-edudash
       ├── Creates parent account
       ├── Creates student profile
       ├── Assigns to default class
       └── Sends welcome email
```

## Setup Steps

### 1. Environment Variables

Add these to your `web/.env.local` file:

```bash
# EduSitePro Database (for registration sync)
NEXT_PUBLIC_EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY=your_edusite_anon_key_here
```

**To get the EduSitePro keys:**
1. Go to the EduSitePro Supabase project (bppuzibjlxgfwrujzfsz)
2. Navigate to Settings → API
3. Copy the anon/public key

### 2. Deploy Edge Function

Deploy the `sync-registration-to-edudash` Edge Function:

```bash
cd /home/king/Desktop/edudashpro

# Deploy the function
supabase functions deploy sync-registration-to-edudash

# Set required secrets (run these in the Supabase dashboard or via CLI)
supabase secrets set EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
supabase secrets set EDUSITE_SUPABASE_SERVICE_ROLE_KEY=your_edusite_service_role_key_here
```

**To get the EduSitePro service role key:**
1. Go to the EduSitePro Supabase project (bppuzibjlxgfwrujzfsz)
2. Navigate to Settings → API
3. Copy the service_role key (keep this secret!)

### 3. Update EduSitePro Schema

Add sync tracking columns to the `registration_requests` table in EduSitePro:

```sql
-- Run this in the EduSitePro database
ALTER TABLE registration_requests
ADD COLUMN IF NOT EXISTS synced_to_edudash BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS edudash_student_id UUID,
ADD COLUMN IF NOT EXISTS edudash_parent_id UUID;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_registration_requests_synced 
ON registration_requests(synced_to_edudash, status);
```

### 4. Verify SuperAdmin Access

Ensure your account has `superadmin` role:

```sql
-- Run in EduDashPro database
UPDATE profiles 
SET role = 'superadmin' 
WHERE email = 'your_email@example.com';
```

### 5. Test the System

1. **Access the Admin Panel:**
   - Navigate to `/admin/registrations`
   - You should see all pending registrations from EduSitePro

2. **Test Notifications:**
   - The bell icon in the admin header shows pending count
   - Browser notifications appear for new registrations (every 30 seconds)
   - Sound plays when new registrations arrive (can toggle on/off)

3. **Test Approval Flow:**
   - Click "Approve" on a pending registration
   - Verify:
     - Parent account created in EduDashPro
     - Student profile created
     - Welcome email sent
     - Registration marked as synced in EduSitePro

4. **Test Rejection Flow:**
   - Click "Reject" on a pending registration
   - Enter a rejection reason
   - Verify status updated in EduSitePro

## Features

### Real-time Notifications
- Polls EduSitePro database every 30 seconds
- Shows unread count in bell icon badge
- Browser notifications (requires permission)
- Optional notification sound

### Registration Review
- Filter by status (pending/approved/rejected)
- Filter by school/organization
- Search by student name, guardian name, or email
- View full registration details in modal
- One-click approve/reject with confirmation

### Automatic Sync
When a registration is approved:
1. Creates parent account with auto-generated secure password
2. Creates student profile linked to parent
3. Assigns student to default class (if available)
4. Sends welcome email with password reset link
5. Marks registration as synced in EduSitePro

### Welcome Email
Parents receive:
- Welcome message
- Login credentials (email)
- Password reset link
- School contact information

## Database Schema

### EduSitePro: registration_requests
```typescript
{
  id: string;
  organization_id: string; // Maps to preschool_id in EduDashPro
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address: string;
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender: string;
  status: 'pending' | 'approved' | 'rejected';
  synced_to_edudash: boolean;
  synced_at: string;
  edudash_student_id: string;
  edudash_parent_id: string;
}
```

### EduDashPro: students
```typescript
{
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  preschool_id: string;
  parent_id: string;
  enrollment_status: 'active' | 'inactive';
  enrollment_date: string;
}
```

## Troubleshooting

### Registration not syncing
1. Check Edge Function logs:
   ```bash
   supabase functions logs sync-registration-to-edudash
   ```
2. Verify environment secrets are set correctly
3. Check EduSitePro database permissions

### Notifications not showing
1. Check browser notification permissions
2. Verify `NEXT_PUBLIC_EDUSITE_SUPABASE_URL` is set
3. Check browser console for errors
4. Ensure you're logged in as superadmin

### Welcome email not sending
1. Check `send-email` Edge Function logs
2. Verify `RESEND_API_KEY` is configured
3. Check email logs table in EduDashPro

### Parent account creation fails
1. Email might already exist - function handles this by finding existing parent
2. Check Supabase Auth logs
3. Verify service role key has admin permissions

## Security Considerations

- Service role keys must be kept secret (server-side only)
- Anon keys are safe to expose client-side
- RLS policies ensure tenant isolation
- SuperAdmin role required for access
- All sensitive data transmitted over HTTPS

## Future Enhancements

- [ ] Batch approval (approve multiple at once)
- [ ] Email templates customization per school
- [ ] SMS notifications to parents
- [ ] Document verification workflow
- [ ] Payment tracking integration
- [ ] Age-based automatic class assignment
- [ ] Waiting list management
- [ ] Registration analytics dashboard

## Support

For issues or questions:
- Check Supabase logs for error details
- Review browser console for client-side errors
- Contact EduDash Pro support team
