# Registration Flow Documentation
## Web vs In-App Member Registration

### Overview
EduDash Pro / Soil of Africa supports two primary registration flows:
1. **Web Registration** (via soa-web)
2. **In-App Registration** (via mobile app)

Both flows create members with `membership_status='pending'` by design, requiring approval before full activation.

---

## Web Registration Flow

### Entry Points:
1. **Public Registration**: `soa-web/src/app/register/page.tsx`
   - Accessible at: `https://www.soilofafrica.org/register`
   - No invite code required
   - Creates auth user + organization member
   
2. **Invite Code Registration**: `soa-web/src/app/join/page.tsx`
   - Accessible at: `https://www.soilofafrica.org/join`
   - Requires valid invite code
   - Links to existing organization/region

### Steps:
1. **User Input**: Email, password, name, phone, ID number
2. **Region Selection**: User selects their region (Gauteng, KZN, etc.)
3. **Membership Tier**: User selects tier (standard, silver, gold, platinum)
4. **Auth Creation**: 
   ```typescript
   const { data: authData } = await supabase.auth.signUp({
     email: formData.email,
     password: formData.password,
     options: {
       data: { first_name, last_name, phone },
       emailRedirectTo: 'https://www.soilofafrica.org/auth/callback?flow=email-confirm'
     }
   });
   ```
5. **Member Record Creation**:
   ```typescript
   await supabase.rpc('register_organization_member', {
     p_organization_id: SOA_ORGANIZATION_ID,
     p_user_id: authData.user?.id,
     p_region_id: selectedRegion.id,
     p_member_number: generatedMemberNumber,
     p_member_type: formData.member_type,
     p_membership_tier: formData.membership_tier,
     p_membership_status: 'pending', // ← Always pending on web
     p_seat_status: 'active', // ← Seat is active immediately
     p_joined_via: 'direct_registration'
   });
   ```
6. **Invoice Creation** (if applicable): Creates payment invoice for paid tiers
7. **Email Confirmation**: User receives email to confirm account

### Key Characteristics:
- ✅ `membership_status='pending'` (requires approval)
- ✅ `seat_status='active'` (can log in immediately)
- ✅ `joined_via='direct_registration'`
- ✅ Member number auto-generated: `SOA-{REGION}-{YEAR}-{SEQUENCE}`
- ⏳ Awaits admin approval or payment confirmation

---

## In-App Registration Flow

### Entry Point:
`app/screens/membership/register.tsx`

### Steps:
1. **Organization Selection**: User selects organization to join
2. **Region Selection**: User selects their region within organization
3. **Personal Info**: Name, email, phone, ID number
4. **Membership Details**: Member type, tier selection
5. **Payment** (if applicable): In-app payment for paid tiers
6. **Auth Creation**:
   ```typescript
   const { data: signUpData } = await supabase.auth.signUp({
     email: formData.email,
     password: formData.password,
     options: {
       data: { first_name, last_name, phone }
     }
   });
   ```
7. **Member Record Creation**:
   ```typescript
   const { data: memberData } = await supabase
     .from('organization_members')
     .insert({
       organization_id: selectedOrg.id,
       region_id: selectedRegion.id,
       user_id: newUserId,
       member_number: generatedMemberNumber,
       member_type: formData.member_type,
       membership_tier: formData.tier,
       membership_status: 'pending', // ← Always pending
       seat_status: 'active',
       first_name, last_name, email, phone, id_number,
       joined_via: 'mobile_app'
     });
   ```

### Key Characteristics:
- ✅ `membership_status='pending'` (requires approval)
- ✅ `seat_status='active'` (can use app immediately)
- ✅ `joined_via='mobile_app'`
- ✅ Member number auto-generated
- ⏳ Awaits admin approval

---

## Activation Process

### Manual Activation:
Admins can activate pending members via:
1. **SQL Function**: `activate_organization_member(member_uuid)`
2. **Bulk Activation**: `bulk_activate_organization_members(organization_uuid)`

### Automatic Activation:
Members are automatically activated when:
1. **Payment Confirmed**: Invoice marked as paid → auto-activate
2. **Admin Approval**: Admin manually approves in dashboard
3. **Invite Code Used**: Valid invite code grants immediate activation

### Database Changes:
```sql
UPDATE organization_members
SET membership_status = 'active',
    seat_status = 'active',
    updated_at = NOW()
WHERE id = member_uuid;
```

---

## Status States

### `membership_status`:
- `pending` → Awaiting approval/payment
- `active` → Fully activated member
- `suspended` → Temporarily disabled
- `expired` → Membership expired
- `cancelled` → Membership cancelled

### `seat_status`:
- `active` → Can log in and use system
- `inactive` → Cannot log in
- `pending` → Awaiting seat assignment

### Typical Combinations:
| membership_status | seat_status | Description |
|---|---|---|
| `pending` | `active` | Registered via web, can log in, awaits approval |
| `active` | `active` | Fully activated member |
| `active` | `inactive` | Suspended/removed from organization |
| `pending` | `pending` | Invited but not yet accepted |

---

## Key Differences: Web vs In-App

| Feature | Web Registration | In-App Registration |
|---------|------------------|---------------------|
| **Entry URL** | soilofafrica.org/register | N/A (app screen) |
| **Initial Status** | `membership_status='pending'` | `membership_status='pending'` |
| **Seat Access** | `seat_status='active'` | `seat_status='active'` |
| **Email Confirmation** | Required | Required |
| **Payment Flow** | Redirect to PayFast | In-app payment |
| **joined_via** | `direct_registration` | `mobile_app` |
| **Redirect After** | Email confirmation page | App dashboard |
| **Organization Selection** | Fixed (Soil of Africa) | Dropdown selection |

---

## Recent Fix (2026-01-10)

### Problem:
- 9 members registered via web had `membership_status='pending'`
- Youth President and Secretary dashboards showed them as "pending"
- ID cards not showing profile pictures

### Solution:
1. **Activated Pending Members**:
   ```sql
   UPDATE organization_members
   SET membership_status = 'active'
   WHERE organization_id = 'SOA-ORG-ID'
     AND membership_status = 'pending'
     AND seat_status = 'active';
   ```

2. **Fixed Profile Pictures**:
   - Added join to `profiles.avatar_url` in `useIDCard.ts`
   - Created trigger to auto-sync `profiles.avatar_url` → `organization_members.photo_url`
   - Updated ID card hook to fall back to profile avatar if photo_url is NULL

3. **Created Helper Functions**:
   - `activate_organization_member(UUID)` - Activate single member
   - `bulk_activate_organization_members(UUID)` - Activate all pending members in org

### Result:
- ✅ All 9 pending members now active
- ✅ ID cards can display profile pictures
- ✅ Auto-sync trigger prevents future mismatches

---

## Going Forward

### Recommended Flow:
1. **Web Registration** → Always set `membership_status='pending'`
2. **Admin Dashboard** → Provide "Activate Pending Members" button
3. **Payment Webhook** → Auto-activate on successful payment
4. **Email Notification** → Notify member when activated

### Admin Actions:
- **View Pending**: Query `WHERE membership_status='pending'`
- **Bulk Activate**: Call `bulk_activate_organization_members(org_id)`
- **Individual Activate**: Call `activate_organization_member(member_id)`

### Profile Picture Sync:
- ✅ **Automatic**: Trigger syncs `profiles.avatar_url` → `organization_members.photo_url`
- ✅ **Fallback**: ID card hook checks both fields
- ✅ **Manual Sync**: Can run SQL to sync existing avatars

---

## Related Files

### Web Registration:
- `soa-web/src/app/register/page.tsx` - Public registration
- `soa-web/src/app/join/page.tsx` - Invite code registration
- `web/src/lib/services/registrationService.ts` - Registration service

### In-App Registration:
- `app/screens/membership/register.tsx` - Multi-step registration
- `components/membership/registration/` - Step components

### Activation:
- `supabase/migrations/20260110_fix_pending_members_and_photos.sql` - Fix migration
- SQL Functions: `activate_organization_member`, `bulk_activate_organization_members`

### ID Cards:
- `components/membership/MemberIDCard.tsx` - Card component
- `hooks/membership/useIDCard.ts` - Card data hook (fixed)
- `app/screens/membership/id-card.tsx` - ID card screen

---

**Last Updated**: 2026-01-10
**Migration**: `20260110_fix_pending_members_and_photos.sql`
