# Registration Investigation: banyanekarabo3@gmail.com

## Date: 2026-01-10

## Issue
Youth Secretary attempted to register `banyanekarabo3@gmail.com` but the registration was **NOT SUCCESSFUL**.

## Investigation Results

### ❌ User Does Not Exist
**Checked Tables**:
1. ✗ `profiles` - No record found
2. ✗ `auth.users` - No record found
3. ✗ `organization_members` - No record found
4. ✗ `join_requests` - No record found

**Conclusion**: The registration **completely failed** - no data was written to the database.

---

## Root Cause: Fake Registration Screen

### Problem Screen: `app/screens/membership/add-member.tsx`

**Lines 154-181 - The Issue**:
```typescript
const handleSubmit = async () => {
  if (!validateForm()) return;
  
  setIsSubmitting(true);
  
  try {
    // ❌ FAKE API CALL - Just waits 1.5 seconds
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // ❌ FAKE member number generation (not saved)
    const year = new Date().getFullYear().toString().slice(-2);
    const sequence = String(Math.floor(Math.random() * 9999) + 1).padStart(5, '0');
    const memberNumber = `SOA-${selectedRegion?.code}-${year}-${sequence}`;
    
    // ❌ FAKE success alert - Nothing was actually saved!
    Alert.alert(
      'Member Added Successfully',
      `${formData.first_name} ${formData.last_name} has been registered.\n\nMember Number: ${memberNumber}`,
      [
        { text: 'Add Another', onPress: () => setFormData(initialData) },
        { text: 'View Member', onPress: () => router.back() },
      ]
    );
  } catch (error) {
    Alert.alert('Error', 'Failed to add member. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
```

**What This Code Does**:
1. ✓ Validates the form
2. ✓ Shows loading spinner for 1.5 seconds
3. ✓ Generates a fake member number (in memory only)
4. ✓ Shows "success" alert
5. ✗ **DOES NOT** create Supabase Auth account
6. ✗ **DOES NOT** create profile
7. ✗ **DOES NOT** create organization member
8. ✗ **DOES NOT** send confirmation email
9. ✗ **DOES NOT** save anything to database

---

## How It Should Work

### Correct Registration Flow (from `register.tsx`):

```typescript
// 1. Create Supabase Auth account
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
});

// 2. Get the created user
const user = signUpData.user;

// 3. Create organization member via RPC
const { data: rpcResult, error: rpcError } = await supabase.rpc(
  'register_organization_member',
  {
    p_organization_id: formData.organization_id,
    p_user_id: user.id,
    p_region_id: formData.region_id,
    p_member_number: memberNumber,
    p_member_type: formData.member_type,
    p_membership_tier: 'standard',
    p_membership_status: 'active',
    p_first_name: formData.first_name,
    p_last_name: formData.last_name,
    p_email: formData.email,
    p_phone: formData.phone,
    p_id_number: null,
    p_role: 'member',
    p_invite_code_used: null,
    p_joined_via: 'direct',
  }
);
```

---

## What the RPC Function Does

### `register_organization_member()` RPC:
1. Creates/updates profile in `profiles` table
2. Creates member record in `organization_members` table
3. Generates proper member number
4. Sets seat_status to 'active'
5. Returns success/error response

### Database Triggers:
- `auth.users` insert → auto-creates `profiles` record
- Supabase sends confirmation email automatically

---

## Fix Required

### Update `app/screens/membership/add-member.tsx`

Replace the fake `handleSubmit` function with proper implementation:

```typescript
const handleSubmit = async () => {
  if (!validateForm()) return;
  
  setIsSubmitting(true);
  
  try {
    const supabase = assertSupabase();
    
    // 1. Generate temporary password (user will reset via email)
    const tempPassword = generateSecurePassword(); // Or ask secretary to set one
    
    // 2. Create Supabase Auth account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: tempPassword,
      options: {
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
        },
        emailRedirectTo: 'https://www.soilofafrica.org/auth/callback?flow=email-confirm',
      },
    });
    
    if (signUpError) throw signUpError;
    if (!signUpData.user) throw new Error('Failed to create user account');
    
    // 3. Generate member number
    const year = new Date().getFullYear().toString().slice(-2);
    const sequence = String(Math.floor(Math.random() * 9999) + 1).padStart(5, '0');
    const memberNumber = `SOA-${selectedRegion?.code}-${year}-${sequence}`;
    
    // 4. Create organization member record
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'register_organization_member',
      {
        p_organization_id: organizationId, // From context
        p_user_id: signUpData.user.id,
        p_region_id: formData.region_id,
        p_member_number: memberNumber,
        p_member_type: formData.member_type,
        p_membership_tier: 'standard',
        p_membership_status: formData.membership_status || 'active',
        p_first_name: formData.first_name,
        p_last_name: formData.last_name,
        p_email: formData.email,
        p_phone: formData.phone,
        p_id_number: formData.id_number || null,
        p_role: 'member',
        p_invite_code_used: null,
        p_joined_via: 'admin_add',
      }
    );
    
    if (rpcError) throw rpcError;
    if (!rpcResult?.success) throw new Error(rpcResult?.error || 'Failed to register member');
    
    // 5. Show success
    Alert.alert(
      'Member Added Successfully',
      `${formData.first_name} ${formData.last_name} has been registered.\n\nMember Number: ${memberNumber}\n\nA confirmation email has been sent to ${formData.email}`,
      [
        { text: 'Add Another', onPress: () => setFormData(initialData) },
        { text: 'View Member', onPress: () => router.back() },
      ]
    );
  } catch (error: any) {
    console.error('[AddMember] Registration error:', error);
    Alert.alert('Error', error?.message || 'Failed to add member. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## Summary

### Current State:
- ❌ `add-member.tsx` screen is **completely fake**
- ❌ Shows success but saves nothing
- ❌ Secretary thinks member is registered but they're not
- ❌ No email sent, no account created, no database record

### What Needs to Happen:
1. Fix `add-member.tsx` to actually register members
2. Use same RPC as `register.tsx` and `join.tsx`
3. Create Supabase Auth accounts
4. Send confirmation emails
5. Create proper database records

### Alternative:
- Remove `add-member.tsx` screen entirely
- Have secretary use invite code system instead
- This is more secure and already works properly

---

## Recommendation

**Option 1 (Recommended)**: Remove the fake screen and use invite codes exclusively
- More secure (members set their own passwords)
- Already implemented and working
- Better user experience

**Option 2**: Fix the add-member screen
- Implement proper registration logic
- Handle password generation/setup
- More complex but gives secretary direct control

---

## Related Files:
- `app/screens/membership/add-member.tsx` - **BROKEN** (fake registration)
- `app/screens/membership/register.tsx` - ✓ Working (self-registration)
- `app/screens/membership/join.tsx` - ✓ Working (invite code join)
- `app/screens/membership/youth-invite-code.tsx` - ✓ Working (invite generation)
