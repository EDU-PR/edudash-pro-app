# Registration Approval Flow Documentation

## Overview
This document describes what happens when a registration is approved in EduSitePro admin panel and how parent accounts are created in EduDashPro.

## The Complete Flow

### 1. Parent Submits Registration (EduSitePro)
**File:** `edusitepro/src/components/registration/PublicRegistrationForm.tsx`

- Parent fills out registration form on public website
- Form validates email in real-time (prevents duplicates)
- Registration saved to `registration_requests` table in **EduSitePro database**
- Status: `pending`
- Email validation ensures no duplicate submissions

### 2. Admin Approves in EduSitePro
**File:** `edusitepro/src/app/dashboard/admin/registrations/[id]/page.tsx`

```typescript
const handleApprove = async () => {
  const { error } = await supabase
    .from('registration_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
    })
    .eq('id', registration.id);
}
```

**What happens:**
- Status changed from `pending` → `approved`
- `approved_at` timestamp set
- `approved_by` set to admin user ID
- **NO automatic sync to EduDashPro** (this is manual)

### 3. Manual Sync to EduDashPro
**File:** `supabase/functions/sync-registration-to-edudash/index.ts`

Principals must manually trigger sync in EduDashPro dashboard or via Edge Function.

**How to trigger:**
- Option A: Principal clicks "Sync from EduSite" in EduDashPro registrations page
- Option B: Call Edge Function directly:
```bash
curl -X POST 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registration-to-edudash' \
  -H 'Authorization: Bearer {anon_key}' \
  -d '{"registration_id": "uuid-here"}'
```

**What the function does:**

#### Step 1: Fetch Registration from EduSitePro
```typescript
const { data: registration } = await edusiteproClient
  .from('registration_requests')
  .select('*')
  .eq('id', registration_id)
  .maybeSingle();
```

#### Step 2: Create or Find Parent Account
```typescript
// Normalize email to lowercase
const normalizedEmail = registration.guardian_email.toLowerCase().trim();

// Check if parent profile exists (case-insensitive)
const { data: existingParent } = await edudashClient
  .from('profiles')
  .select('id, auth_user_id')
  .ilike('email', normalizedEmail)
  .eq('role', 'parent')
  .maybeSingle();

if (existingParent) {
  // Use existing parent
  parentUserId = existingParent.auth_user_id;
  parentProfileId = existingParent.id;
} else {
  // Check for orphaned auth user (user without profile)
  const { data: authUsers } = await edudashClient.auth.admin.listUsers();
  const existingAuthUser = authUsers?.users.find(u => 
    u.email?.toLowerCase() === normalizedEmail
  );
  
  if (existingAuthUser) {
    // Orphaned user - just create profile
    parentUserId = existingAuthUser.id;
  } else {
    // Create new auth user
    const tempPassword = crypto.randomUUID();
    const { data: newUser } = await edudashClient.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });
    parentUserId = newUser.user.id;
  }
  
  // Create profile
  const nameParts = registration.guardian_name.split(' ');
  const { data: newProfile } = await edudashClient
    .from('profiles')
    .insert({
      auth_user_id: parentUserId,
      email: normalizedEmail,
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' '),
      phone: registration.guardian_phone,
      role: 'parent',
      preschool_id: registration.organization_id,
      address: registration.guardian_address,
    })
    .select()
    .single();
  
  parentProfileId = newProfile.id;
}
```

#### Step 3: Create Student Profile
```typescript
const { data: newStudent } = await edudashClient
  .from('students')
  .insert({
    first_name: registration.student_first_name,
    last_name: registration.student_last_name,
    date_of_birth: registration.student_dob,
    gender: registration.student_gender,
    parent_id: parentUserId,
    preschool_id: registration.organization_id,
    status: 'active',
    enrollment_date: new Date().toISOString(),
  })
  .select()
  .single();
```

#### Step 4: Send Welcome Email
```typescript
// Generate password reset URL
const { data: { properties: { action_link } } } = 
  await edudashClient.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
  });

const resetPasswordUrl = action_link;

// Send branded email with:
// - Welcome message
// - Account details
// - Password reset button
// - Mobile app link
```

#### Step 5: Update EduSitePro Record
```typescript
await edusiteproClient
  .from('registration_requests')
  .update({
    synced_to_edudash: true,
    synced_at: new Date().toISOString(),
    edudash_student_id: newStudent.id,
    edudash_parent_id: parentProfileId,
  })
  .eq('id', registration_id);
```

## Important Features

### Email Case Sensitivity
- All emails normalized to lowercase
- Case-insensitive matching prevents duplicates
- Handles: `Test@Email.com` = `test@email.com`

### Orphaned User Handling
- Checks if user exists in `auth.users` but has no profile
- Creates profile for orphaned users instead of failing
- Fixes broken sync states

### Duplicate Prevention
- Registration form validates email in real-time
- Shows error if email already registered
- Prevents multiple registrations for same email

## Password Reset for Parents

### From Principal Dashboard
**File:** `web/src/app/dashboard/principal/students/[id]/page.tsx`

Principals can send password reset emails directly from student detail page:

```typescript
const handleSendPasswordReset = async () => {
  const { error } = await supabase.auth.resetPasswordForEmail(
    student.profiles.email,
    { redirectTo: `${window.location.origin}/reset-password` }
  );
};
```

**UI Location:**
- Dashboard → Students → [Student Name] → Guardian Information card
- "Send Password Reset" button next to parent email
- Use this if parent can't login or forgot password

## Database Tables

### EduSitePro Database
- `registration_requests` - Original registrations from public form
- Contains: student info, guardian info, payment details
- Status: `pending`, `approved`, `rejected`, `waitlisted`

### EduDashPro Database
- `auth.users` - Supabase auth users (parents, teachers, principals)
- `profiles` - Extended user info (name, phone, role, school)
- `students` - Student records linked to parents
- `preschools` - School/organization records

## Common Issues & Solutions

### Issue: "User already exists" error
**Cause:** Auth user exists but no profile (orphaned user)
**Solution:** Updated Edge Function now handles this automatically

### Issue: Password reset redirects to homepage
**Cause:** Site URL configured incorrectly or email template not updated
**Solution:** 
1. Keep Site URL as `https://edudashpro.org.za`
2. Update email template in Supabase dashboard with redirect_to parameter
3. See `UPDATE_SUPABASE_EMAIL_TEMPLATE.md`

### Issue: Duplicate registrations
**Cause:** Multiple submissions before validation was added
**Solution:**
1. Delete duplicate entries manually
2. Keep only approved registration
3. Email validation now prevents new duplicates

### Issue: Parent can't login
**Solution:** Use "Send Password Reset" button in Principal dashboard student detail page

## Testing the Flow

1. **Submit test registration** in EduSitePro public form
2. **Approve in EduSitePro** admin dashboard
3. **Check databases:**
   ```sql
   -- EduSitePro - should show approved
   SELECT status, synced_to_edudash FROM registration_requests 
   WHERE guardian_email = 'test@example.com';
   
   -- EduDashPro - should be empty before sync
   SELECT email FROM profiles WHERE email = 'test@example.com';
   ```
4. **Trigger sync** via Edge Function or dashboard
5. **Check EduDashPro:**
   ```sql
   -- Should now have parent and student
   SELECT * FROM profiles WHERE email = 'test@example.com';
   SELECT * FROM students WHERE parent_id IN (
     SELECT auth_user_id FROM profiles WHERE email = 'test@example.com'
   );
   ```
6. **Check email** - parent should receive welcome email with password reset link
7. **Test login** - parent should be able to set password and login

## Future Improvements

- [ ] Automatic sync on approval (database trigger)
- [ ] Batch sync for multiple registrations
- [ ] Better error handling and retry logic
- [ ] Email notification to principal when sync completes
- [ ] Dashboard to monitor sync status
- [ ] Automatic duplicate cleanup
