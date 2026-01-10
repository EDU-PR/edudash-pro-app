# RBAC Routing System Documentation

## Date: 2026-01-10

## Overview
This document provides comprehensive documentation of the RBAC (Role-Based Access Control) routing system for EduDash Pro, specifically for the Soil of Africa organization structure.

---

## Dashboard Routing Logic

### Priority Order
1. **Super Admin** (highest priority) - Platform administrators
2. **Member Type** (organization roles) - Youth Wing, Women's League, National Executive, etc.
3. **Role** (system roles) - Teacher, Parent, Student, Principal
4. **Default Fallback** - Member dashboard

---

## Super Admin Routes

### Platform Admins
- **Roles**: `super_admin`, `superadmin`, `platform_admin`
- **Route**: `/screens/super-admin-dashboard`
- **Access**: Only `superadmin@edudashpro.org.za`

---

## Organization-Based Routes (Member Type)

### National Executive
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `president` / `national_president` | National President | `/screens/membership/national-president-dashboard` |
| `deputy_president` / `national_deputy` | Deputy President | `/screens/membership/deputy-president-dashboard` |
| `secretary_general` | Secretary General | `/screens/membership/secretary-general-dashboard` |
| `treasurer` / `national_treasurer` | National Treasurer | `/screens/membership/treasurer-dashboard` |

### Youth Wing
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `youth_president` | Youth President | `/screens/membership/youth-president-dashboard` |
| `youth_deputy` | Youth Deputy President | `/screens/membership/youth-deputy-dashboard` |
| `youth_secretary` | Youth Secretary | `/screens/membership/youth-secretary-dashboard` |
| `youth_treasurer` | Youth Treasurer | `/screens/membership/youth-treasurer-dashboard` |
| `youth_member` | Youth Member | `/screens/membership/member-dashboard` |
| `youth_facilitator` | Youth Facilitator | `/screens/membership/facilitator-dashboard` |
| `youth_mentor` | Youth Mentor | `/screens/membership/facilitator-dashboard` |

### Women's League
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `women_president` | Women's President | `/screens/membership/women-president-dashboard` |
| `women_deputy` | Women's Deputy President | `/screens/membership/women-deputy-dashboard` |
| `women_secretary` | Women's Secretary | `/screens/membership/women-secretary-dashboard` |
| `women_treasurer` | Women's Treasurer | `/screens/membership/women-treasurer-dashboard` |

### Veterans League
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `veterans_president` | Veterans President | `/screens/membership/veterans-president-dashboard` |

### Regional/Provincial Management
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `regional_manager` / `regional_coordinator` | Regional Manager | `/screens/membership/regional-manager-dashboard` |
| `provincial_manager` / `provincial_coordinator` | Provincial Manager | `/screens/membership/provincial-manager-dashboard` |
| `branch_manager` | Branch Manager | `/screens/membership/branch-manager-dashboard` |

### Administrative Roles
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `national_coordinator` | National Coordinator | `/screens/membership/executive-dashboard` |
| `national_admin` | National Administrator | `/screens/membership/executive-dashboard` |
| `executive` | Executive Member | `/screens/membership/executive-dashboard` |

### Operational Roles
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `facilitator` | Facilitator | `/screens/membership/facilitator-dashboard` |
| `mentor` | Mentor | `/screens/membership/facilitator-dashboard` |

### Base Member Roles
| Member Type | Display Name | Dashboard Route |
|------------|--------------|-----------------|
| `learner` | Learner | `/screens/membership/member-dashboard` |
| `member` | Member | `/screens/membership/member-dashboard` |

---

## System Role-Based Routes (Fallback)

### School/Education Roles
| Role | Display Name | Dashboard Route |
|------|--------------|-----------------|
| `admin` / `principal` / `principal_admin` | Principal/Admin | `/screens/principal-dashboard` |
| `teacher` | Teacher | `/screens/teacher-dashboard` |
| `parent` | Parent | `/screens/parent-dashboard` |
| `student` | Student | `/screens/student-dashboard` |

---

## Registration Flows

### Flow 1: Admin Add Member (add-member.tsx)
**Used by**: Youth Secretary, National Admin, Regional Managers

**Process**:
1. Admin fills form with member details
2. System generates temporary password
3. Creates Supabase Auth account
4. Calls `register_organization_member()` RPC
5. Creates `profiles` and `organization_members` records
6. Shows temp password to admin
7. Admin shares temp password with new member

**Temp Password Format**: `Word+Year+Symbol` (e.g., `Tiger2024!`)

**Member Number Format**: `SOA-{REGION}-{YEAR}-{SEQUENCE}` (e.g., `SOA-GP-26-00123`)

**RBAC**: Member routed based on `member_type` set in form

### Flow 2: Invite Code Join (join.tsx)
**Used by**: New members joining via invite code

**Process**:
1. Member receives invite code from secretary/admin
2. Member must already have account OR creates account first
3. Member enters invite code
4. System verifies code validity
5. Member fills personal details
6. Calls `register_organization_member()` RPC
7. Links existing auth account to organization
8. Member routed to appropriate dashboard

**RBAC**: Member routed based on `requested_role` in invite code

### Flow 3: Self-Registration (register.tsx)
**Used by**: Public registration (if enabled)

**Process**:
1. User fills multi-step form
2. Creates Supabase Auth account (user sets password)
3. Calls `register_organization_member()` RPC
4. Email confirmation sent
5. User confirms email
6. User routed to dashboard

**RBAC**: Default to `member` type, routed to member dashboard

---

## Database Tables

### `profiles`
- **Primary Key**: `id` (UUID)
- **Key Fields**: `email`, `role`, `full_name`, `organization_id`, `preschool_id`
- **RBAC Field**: `role` (system role - fallback routing)

### `organization_members`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `user_id` → `profiles.id`, `organization_id` → `organizations.id`
- **Key Fields**: `member_type`, `member_number`, `seat_status`, `membership_tier`
- **RBAC Field**: `member_type` (organization role - primary routing)

### `auth.users` (Supabase Auth)
- **Primary Key**: `id` (UUID)
- **Key Fields**: `email`, `email_confirmed_at`
- **Note**: Managed by Supabase Auth, triggers profile creation

---

## RBAC Implementation

### Function: `getDashboardRoute(memberType, role)`
**Location**: `lib/memberRegistrationUtils.ts`

**Logic**:
```typescript
1. Check if super admin (role) → super-admin-dashboard
2. Check member_type → specific dashboard
3. Check role → school/system dashboard
4. Fallback → member-dashboard
```

**Usage**:
```typescript
import { getDashboardRoute } from '@/lib/memberRegistrationUtils';

// After login/registration
const dashboardRoute = getDashboardRoute(
  userProfile.member_type,
  userProfile.role
);
router.replace(dashboardRoute);
```

---

## Temporary Password System

### Generation
**Function**: `generateTemporaryPassword()`
**Location**: `lib/memberRegistrationUtils.ts`

**Format**: `{Word}{Year}{Symbol}`
- **Words**: Tiger, Lion, Eagle, Falcon, Phoenix, Dragon, Panther, Leopard, Cheetah, Hawk, Wolf, Bear, Shark, Cobra, Jaguar
- **Year**: Current year (e.g., 2026)
- **Symbols**: !, @, #, $, %, *

**Examples**:
- `Tiger2026!`
- `Eagle2026@`
- `Lion2026#`

**Security**:
- ✓ Meets minimum 8-character requirement
- ✓ Contains uppercase, lowercase, number, special character
- ✓ Easy to communicate verbally
- ✓ Easy to type
- ✗ Not cryptographically random (trade-off for usability)

**Process**:
1. Admin adds member via add-member screen
2. System generates temp password
3. Admin sees password in success alert
4. Admin can copy password to clipboard
5. Admin shares password securely with member
6. Member logs in and should change password immediately

---

## Email Notifications

### Confirmation Emails (Automatic)
**Trigger**: `auth.signUp()` called
**Sent by**: Supabase Auth
**Contains**:
- Email confirmation link
- Redirect to: `https://www.soilofafrica.org/auth/callback?flow=email-confirm`

### Welcome Emails (TODO)
**Status**: Not yet implemented
**Should contain**:
- Welcome message
- Member number
- Organization details
- Login link
- Contact information

**Recommendation**: Create Edge Function to send after successful registration

---

## Common Issues & Fixes

### Issue 1: Wrong Dashboard
**Symptom**: User sees incorrect dashboard after login
**Cause**: `member_type` or `role` incorrect in database
**Fix**: Update `organization_members.member_type` or `profiles.role`

### Issue 2: Can't Log In
**Symptom**: New member can't log in with temp password
**Cause**: Email not confirmed
**Fix**: Member must click confirmation link in email first

### Issue 3: "Already a Member" Error
**Symptom**: Invite code join shows "already a member"
**Cause**: User already linked to organization
**Fix**: User should log in directly, not use invite code again

### Issue 4: No Dashboard Access
**Symptom**: User logs in but no dashboard appears
**Cause**: `seat_status` = 'inactive' in `organization_members`
**Fix**: Update `seat_status` to 'active'

---

## Security Considerations

### Row Level Security (RLS)
- ✓ `profiles` - users can read own profile + org members
- ✓ `organization_members` - users can read org members, admins can manage
- ✓ Security definer functions prevent recursion
- ✓ All queries filtered by `organization_id`

### Password Security
- ✓ Passwords hashed by Supabase Auth (bcrypt)
- ✓ Temp passwords should be changed on first login
- ⚠️ Temp passwords communicated via admin (potential MITM)
- 🔒 **Recommendation**: Force password change on first login

### Multi-Tenant Isolation
- ✓ All queries filter by `organization_id`
- ✓ RLS policies enforce organization boundaries
- ✓ Users can only see members in their organization

---

## Future Enhancements

### Priority 1: Force Password Change
- Implement "must change password" flag
- Show password change screen on first login
- Track `last_password_change` timestamp

### Priority 2: Welcome Email System
- Create Edge Function for welcome emails
- Include member details, login link
- Add to registration flow

### Priority 3: Invite Code Improvements
- Allow setting member_type in invite code
- Allow pre-defining member details
- Generate unique invite links

### Priority 4: Dashboard Templates
- Create missing dashboards for all roles
- Ensure consistent UX across all dashboards
- Add role-specific quick actions

---

## Testing Checklist

### Registration Testing
- [ ] Admin can add member via add-member screen
- [ ] Temp password is generated and displayed
- [ ] Auth account is created successfully
- [ ] Profile record is created
- [ ] Organization member record is created
- [ ] Member number is unique and correct format
- [ ] Confirmation email is sent
- [ ] Admin can copy temp password

### Login Testing
- [ ] Member can log in with temp password
- [ ] Member is routed to correct dashboard
- [ ] Member sees correct data for their organization
- [ ] Member can access role-appropriate features

### RBAC Testing
- [ ] Super admin routes to super-admin dashboard
- [ ] Youth president routes to youth president dashboard
- [ ] Youth secretary routes to youth secretary dashboard
- [ ] Teachers route to teacher dashboard
- [ ] Parents route to parent dashboard
- [ ] Regular members route to member dashboard

---

## Quick Reference

### Key Functions
```typescript
// Generate temp password
import { generateTemporaryPassword } from '@/lib/memberRegistrationUtils';
const password = generateTemporaryPassword(); // "Tiger2026!"

// Generate member number
import { generateMemberNumber } from '@/lib/memberRegistrationUtils';
const memberNum = generateMemberNumber('GP'); // "SOA-GP-26-00123"

// Get dashboard route
import { getDashboardRoute } from '@/lib/memberRegistrationUtils';
const route = getDashboardRoute('youth_president', null); // "/screens/membership/youth-president-dashboard"

// Validate email
import { isValidEmail } from '@/lib/memberRegistrationUtils';
const valid = isValidEmail('test@example.com'); // true

// Validate SA phone
import { isValidSAPhoneNumber } from '@/lib/memberRegistrationUtils';
const valid = isValidSAPhoneNumber('0821234567'); // true
```

### Key RPC Functions
```sql
-- Register member
SELECT * FROM register_organization_member(
  p_organization_id := '...',
  p_user_id := '...',
  p_member_type := 'youth_member',
  p_first_name := 'John',
  p_last_name := 'Doe',
  p_email := 'john@example.com',
  -- ... other params
);
```

---

## Related Documentation
- `docs/YOUTH_WING_REGISTRATION_FLOW.md` - Youth Wing registration details
- `docs/FAILED_REGISTRATION_INVESTIGATION.md` - Investigation of add-member bug
- `docs/ZANELE_PARENT_CHILD_LINK_ISSUE.md` - Parent-child linking system

---

**Last Updated**: 2026-01-10  
**Author**: AI Assistant  
**Version**: 1.0
