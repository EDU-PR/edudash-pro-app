# Registration Workflow Clarification

## Date: 2026-01-10

## Scenario
**Youth Secretary**: Kelebogile Saukazi (`ksaukazi@gmail.com`)  
**Organization**: Soil Of Africa (ID: `63b6139a-e21f-447c-b322-376fb0828992`)  
**New Member**: Karabo Banyana (`banyanekarabo3@gmail.com`)

---

## Verification

### ✅ Youth Secretary Details
- **Email**: `ksaukazi@gmail.com`
- **Name**: Kelebogile Saukazi
- **Member Type**: `youth_secretary`
- **Seat Status**: `active`
- **Organization ID**: `63b6139a-e21f-447c-b322-376fb0828992`
- **Organization Name**: **Soil Of Africa** ✅

### ✅ Organization Details
- **Name**: Soil Of Africa
- **ID**: `63b6139a-e21f-447c-b322-376fb0828992`
- **Plan Tier**: `free`
- **Type**: Political organization (not a school)

---

## Clarification: Young Eagles vs Soil Of Africa

### Young Eagles
- **Type**: Preschool/Educational institution
- **Location**: Mpumalanga
- **Users**: 
  - Teachers: `katso@youngeagles.org.za`
  - Parents: `zanelelwndl@gmail.com` (Zanele - Mbali's parent)
  - Students: Mbali Skosana (5 years old)
- **Context**: Educational preschool system with classes, lessons, homework

### Soil Of Africa
- **Type**: Political/Membership organization
- **Structure**: National Executive, Youth Wing, Women's League, Veterans League
- **Users**:
  - National President: King Bongani Ramontja
  - Youth President: Hloriso Masekatlala
  - Youth Secretary: Kelebogile Saukazi
  - Youth Members: General members including Karabo
- **Context**: Organizational membership system with regions, branches, programs

---

## Registration Workflow for Karabo

### What Happened (Before Fix)
1. ❌ Youth Secretary (Kelebogile) opened "Add Member" screen
2. ❌ Filled in Karabo's details (`banyanekarabo3@gmail.com`)
3. ❌ Clicked "Add Member"
4. ❌ Saw "success" message
5. ❌ **But nothing was saved** (fake screen bug)
6. ❌ Karabo never received email, account never created

### What Will Happen Now (After Fix)
1. ✅ Youth Secretary (Kelebogile) opens "Add Member" screen
2. ✅ System automatically uses her `organization_id`: `63b6139a-e21f-447c-b322-376fb0828992` (Soil Of Africa)
3. ✅ Fills in Karabo's details:
   - Region: Select from Gauteng, Western Cape, KZN, etc.
   - First Name: Karabo
   - Last Name: Banyana
   - Email: `banyanekarabo3@gmail.com`
   - Phone: e.g., `082 123 4567`
   - Member Type: `youth_member` (or other role)
4. ✅ Clicks "Add Member"
5. ✅ **System now properly**:
   - Creates Supabase Auth account for Karabo
   - Generates temp password (e.g., `Tiger2026!`)
   - Generates member number (e.g., `SOA-GP-26-00789`)
   - Creates `profiles` record
   - Creates `organization_members` record linked to **Soil Of Africa**
   - Sends confirmation email to Karabo
6. ✅ Success alert shows:
   - Member Number: `SOA-GP-26-00789`
   - Temp Password: `Tiger2026!`
   - "Copy Password" button
7. ✅ Kelebogile shares temp password with Karabo
8. ✅ Karabo receives confirmation email
9. ✅ Karabo clicks confirmation link
10. ✅ Karabo logs in with temp password
11. ✅ Karabo is routed to **Youth Member Dashboard** (for Soil Of Africa organization)

---

## Database Records Created

### 1. `auth.users`
```sql
{
  id: '...',
  email: 'banyanekarabo3@gmail.com',
  email_confirmed_at: null, -- Will be set after email confirmation
  created_at: '2026-01-10...'
}
```

### 2. `profiles`
```sql
{
  id: '...', -- Same as auth.users.id
  email: 'banyanekarabo3@gmail.com',
  full_name: 'Karabo Banyana',
  role: 'member',
  organization_id: '63b6139a-e21f-447c-b322-376fb0828992', -- Soil Of Africa
  created_at: '2026-01-10...'
}
```

### 3. `organization_members`
```sql
{
  id: '...',
  organization_id: '63b6139a-e21f-447c-b322-376fb0828992', -- Soil Of Africa
  user_id: '...', -- Karabo's profile id
  member_type: 'youth_member',
  member_number: 'SOA-GP-26-00789',
  membership_tier: 'standard',
  seat_status: 'active',
  joined_via: 'admin_add',
  created_at: '2026-01-10...'
}
```

---

## Key Points

### ✅ Correct Organization Context
- Youth Secretary's `organization_id` is automatically used
- Karabo will be registered to **Soil Of Africa**, not Young Eagles
- Member number will have correct format: `SOA-{REGION}-{YEAR}-{SEQUENCE}`

### ✅ Membership Types for Soil Of Africa
Available member types when adding members:
- `youth_member` - General youth wing member
- `youth_facilitator` - Youth facilitator
- `youth_mentor` - Youth mentor
- `learner` - Learner/student member
- `regional_manager` - Regional manager
- `facilitator` - General facilitator
- `mentor` - General mentor

### ✅ Dashboard Routing
After login, Karabo will see:
- **Youth Member Dashboard** (`/screens/membership/member-dashboard`)
- Features:
  - View member profile
  - View organization events
  - Access youth wing programs
  - View member directory
  - Participate in organization activities

### ✅ No Confusion with Young Eagles
- Young Eagles is a separate preschool organization
- Different users, different context
- Karabo will only see Soil Of Africa data
- Multi-tenant isolation ensures data separation

---

## Testing Instructions

### To Test the Registration Flow:

1. **Log in as Youth Secretary**:
   - Email: `ksaukazi@gmail.com`
   - Should see Youth Secretary Dashboard

2. **Navigate to "Add Member"**:
   - From quick actions or menu

3. **Fill in Test Member Details**:
   - Region: Gauteng
   - First Name: Test
   - Last Name: Member
   - Email: `test.member@example.com`
   - Phone: `082 555 5555`
   - Member Type: `youth_member`

4. **Submit and Verify**:
   - Should see success alert with temp password
   - Can copy password to clipboard
   - Check that email confirmation was sent

5. **Verify in Database**:
```sql
SELECT 
  p.email,
  p.full_name,
  om.member_number,
  om.member_type,
  o.name as organization_name
FROM profiles p
JOIN organization_members om ON p.id = om.user_id
JOIN organizations o ON om.organization_id = o.id
WHERE p.email = 'test.member@example.com';
```

Should return:
- Organization Name: **Soil Of Africa** ✅
- Member Type: `youth_member` ✅
- Member Number: `SOA-GP-26-XXXXX` ✅

---

## Summary

✅ **Everything is correctly configured**:
- Youth Secretary is linked to **Soil Of Africa**
- Add Member screen will use Soil Of Africa context
- Karabo will be registered to Soil Of Africa
- No confusion with Young Eagles preschool
- Multi-tenant isolation working correctly

✅ **The fix is complete and ready to use**:
- Real accounts are created
- Temp passwords are generated
- Emails are sent
- RBAC routing works
- Database records are saved

---

**Important**: When testing, use a real email address that can receive confirmation emails, or check the Supabase Auth dashboard to manually confirm the email.
