# Youth Wing Member Registration Flow Analysis

## Overview
This document analyzes the member registration flow for the Youth Wing (SOA - Soil of Africa) organization, including how members are added and how email notifications are handled.

---

## Issue #1: Zanele Not Seeing Her Child

### Problem
- **Parent**: zanelelwndl@gmail.com (Zanele) - Profile ID: `150f8d13-1b32-48e9-a37c-cf562459030b`
- **Child**: Mbali Skosana - Student ID: `074692f3-f5a3-4fea-977a-b726828e5067`
- **Issue**: No `parent_child_links` record existed linking Zanele to Mbali

### Solution
- Created parent-child link in `parent_child_links` table:
  - `parent_id`: Zanele's profile ID
  - `child_id`: Mbali's student ID
  - `relationship`: 'parent' (valid values: parent, guardian, caregiver, grandparent)
  - `is_primary`: true
  - `can_pick_up`: true
  - `emergency_contact`: true

### Table Structure
```sql
parent_child_links columns:
- id (uuid)
- parent_id (uuid) -> references profiles
- child_id (uuid) -> references students
- relationship (text) -> CHECK constraint: ['parent', 'guardian', 'caregiver', 'grandparent']
- is_primary (boolean)
- can_pick_up (boolean)
- emergency_contact (boolean)
- created_at, updated_at
```

---

## Issue #2: Youth Wing Member Registration Flow

### Registration Methods

#### 1. **Invite Code System** (Main Method for Youth Wing)

**Location**: `app/screens/membership/youth-invite-code.tsx`

**Flow**:
1. **Youth Secretary/President creates invite code**:
   - Generates 6-character alphanumeric code
   - Inserts into `join_requests` table with:
     - `organization_id`: SOA organization ID
     - `request_type`: 'member_join'
     - `invite_code`: Generated code
     - `invited_by`: User ID of creator
     - `requester_id`: User ID of creator
     - `expires_at`: Optional expiry date
     - `message`: Description/notes
     - `status`: 'pending'
     - `requested_role`: Selected role (e.g., 'youth_member')

2. **Potential member joins using code**:
   - Location: `app/screens/membership/join.tsx`
   - Member enters invite code
   - System validates code via `region_invite_codes` or `join_requests` table
   - Creates account via `auth.signUp()` if new user
   - Calls RPC function: `register_organization_member()`
     - Parameters:
       - `p_organization_id`
       - `p_user_id`
       - `p_region_id`
       - `p_member_number` (format: `SOA-{region_code}-{year}-{sequence}`)
       - `p_member_type` (e.g., 'youth_member')
       - `p_membership_tier`: 'standard'
       - `p_membership_status`: 'active'
       - `p_first_name`, `p_last_name`, `p_email`, `p_phone`
       - `p_id_number`, `p_role`, `p_invite_code_used`, `p_joined_via`

3. **After successful registration**:
   - Updates invite code usage count
   - Shows success alert to new member

#### 2. **Direct Member Registration** (Manual Add)

**Location**: `app/screens/membership/register.tsx`

**Flow**:
1. Admin/Secretary fills out multi-step form:
   - Step 1: Personal info (name, email, phone, password)
   - Step 2: Region/Branch selection
   - Step 3: Member type selection
   - Step 4: Review

2. **Creates Supabase Auth Account**:
   ```typescript
   supabase.auth.signUp({
     email: formData.email,
     password: formData.password,
     options: {
       data: {
         first_name: formData.first_name,
         last_name: formData.last_name,
         phone: formData.phone,
       },
       emailRedirectTo: 'https://www.soilofafrica.org/auth/callback?flow=email-confirm',
     },
   })
   ```

3. **Creates organization member record**:
   - Uses RPC function or direct insert to `organization_members` table
   - Generates member number

#### 3. **Executive Position Invite**

**Location**: `app/screens/membership/youth-executive-invite.tsx`

**Flow**:
1. Youth President/Secretary creates executive invite:
   - Selects position (youth_deputy, youth_treasurer, etc.)
   - Optionally enters email/phone
   - Generates invite code
   - Inserts into `join_requests` with:
     - `request_type`: 'staff_invite'
     - `requested_role`: Executive position ID

2. Invited person uses code to accept position
3. System updates their `member_type` in `organization_members`

---

## Email Notification System

### Current Implementation

#### 1. **Supabase Auth Emails** (Automatic)
When `auth.signUp()` is called:
- ✅ **Confirmation email sent automatically** by Supabase Auth
- Email contains magic link to confirm email address
- Redirect URL: `https://www.soilofafrica.org/auth/callback?flow=email-confirm`
- **No custom trigger needed** - handled by Supabase Auth system

#### 2. **Custom Welcome Emails** (Manual/Edge Function)
**Location**: `supabase/functions/send-email/index.ts`

**Not Currently Triggered for Member Registration**:
- The system has an `Edge Function` for sending emails
- Uses Supabase's built-in email service
- However, **no automatic trigger exists** for sending welcome emails to new members
- Only sends auth confirmation emails

#### 3. **Notification Dispatcher** (For App Events)
**Location**: `supabase/functions/notifications-dispatcher/index.ts`

**Handles**:
- New messages
- Announcements
- Homework graded
- Payment notifications
- **Does NOT handle member registration emails**

---

## Email Flow for New Members

### What Happens Now:
1. ✅ New member registers via invite code or manual registration
2. ✅ `auth.signUp()` is called
3. ✅ **Supabase sends confirmation email automatically**
4. ✅ Member clicks link in email to verify
5. ✅ Member can log in after verification
6. ❌ **No custom welcome email is sent** with membership details

### What's Missing:
- **No welcome email** with:
  - Member number
  - Organization details
  - Next steps
  - Contact information
  - Login instructions

---

## Recommendations

### 1. Add Welcome Email Trigger
Create a database trigger or Edge Function call after successful registration:

```sql
-- Option 1: Database trigger on organization_members table
CREATE TRIGGER send_welcome_email_trigger
AFTER INSERT ON organization_members
FOR EACH ROW
EXECUTE FUNCTION trigger_welcome_email();
```

### 2. Create Welcome Email Edge Function
```typescript
// supabase/functions/send-welcome-email/index.ts
// Triggered after organization_members INSERT
// Sends custom email with:
// - Welcome message
// - Member number
// - Organization info
// - Login link
// - Contact details
```

### 3. Email Template Structure
```
Subject: Welcome to Soil of Africa - Youth Wing

Dear [First Name],

Welcome to the Soil of Africa Youth Wing!

Your membership has been successfully registered.

Membership Details:
- Member Number: SOA-[REGION]-[YEAR]-[SEQUENCE]
- Region: [Region Name]
- Member Type: [Youth Member/Executive]
- Status: Active

Next Steps:
1. Confirm your email (check your inbox)
2. Complete your profile
3. Attend your first meeting
4. Connect with your regional coordinator

Login Details:
- Email: [user@email.com]
- Portal: https://app.edudashpro.org.za

For assistance, contact:
- Regional Coordinator: [coordinator@email.com]
- Youth Secretary: [secretary@email.com]

Best regards,
Soil of Africa Youth Wing
```

---

## Technical Details

### Tables Involved:
1. **`auth.users`** - Supabase Auth accounts
2. **`profiles`** - User profiles
3. **`organization_members`** - Member records with member_type, seat_status
4. **`join_requests`** - Invite codes and join requests
5. **`region_invite_codes`** - Regional invite codes (legacy)

### Key RPC Functions:
- `register_organization_member()` - Main registration function
- Creates/updates profiles
- Creates organization_members record
- Handles existing vs new member logic

### Member Types:
- `youth_member` - Regular youth member
- `youth_president` - Youth President
- `youth_deputy` - Youth Deputy President
- `youth_secretary` - Youth Secretary
- `youth_treasurer` - Youth Treasurer
- `youth_coordinator` - Regional coordinator
- `youth_facilitator` - Facilitator
- `youth_mentor` - Mentor

---

## Summary

### Current State:
✅ **Registration works** - members can join via invite codes
✅ **Auth emails work** - Supabase sends confirmation emails
❌ **Welcome emails missing** - no custom emails with membership details
❌ **No automated email workflow** - manual follow-up required

### Next Steps:
1. Implement welcome email Edge Function
2. Create database trigger for new member registrations
3. Design email templates
4. Test email delivery
5. Add email preferences for members

---

## File Created: 2026-01-10
**Related Files**:
- `app/screens/membership/youth-invite-code.tsx`
- `app/screens/membership/join.tsx`
- `app/screens/membership/register.tsx`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/notifications-dispatcher/index.ts`
