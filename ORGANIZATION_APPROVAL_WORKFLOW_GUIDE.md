# Organization Registration Approval Workflow - Implementation Guide

## Overview

We've implemented a **SuperAdmin approval workflow** for organization registrations that ensures all organizations are reviewed and approved before being activated in both EduSitePro and EduDashPro systems.

## Architecture

```
User Registration Flow:
1. User fills out registration form on EduDashPro
2. Form submits to EduSitePro API (/api/organizations/register)
3. Request stored in `organization_registration_requests` table (EduSitePro DB)
4. User redirected to "Pending Approval" page
5. SuperAdmin reviews request in EduSitePro admin panel
6. On approval:
   - Organization + Centre created in EduSitePro (DB2)
   - Organization + Preschool synced to EduDashPro (DB1) with SAME UUID
   - Auth users created in BOTH systems
   - User profiles created in both databases
   - Request marked as approved with tracking IDs
7. User receives email notification (to be implemented)
8. User can now sign in to both platforms
```

## Files Created

### 1. Database Migration (EduSitePro)
**File:** `/edusitepro/supabase/migrations/20251201000002_organization_registration_requests.sql`

Creates:
- `organization_registration_requests` table
- Stores all form data including temporary password hash
- Status tracking (pending/approved/rejected)
- RLS policies for SuperAdmin access and public insertion

**Status:** ⚠️ **NOT YET APPLIED** - Needs to be migrated to database

### 2. Registration Submission API (EduSitePro)
**File:** `/edusitepro/src/app/api/organizations/register/route.ts`

Features:
- Accepts POST requests with organization registration data
- Validates all required fields (personal, org, address, campus)
- Hashes password with bcrypt (temporary storage)
- Checks for duplicate email/slug
- Creates pending registration request
- Returns 201 with request ID

**Status:** ✅ Created and ready

### 3. Approval API Endpoint (EduSitePro)
**File:** `/edusitepro/src/app/api/organizations/approve/[requestId]/route.ts`

Features:
- **POST**: Approve request
  - Creates organization + centre in EduSitePro (DB2)
  - Creates organization + preschool in EduDashPro (DB1) with same UUID
  - Creates auth users in both Supabase instances
  - Updates user profiles in both databases
  - Marks request as approved with tracking
  - Handles rollback on failure

- **DELETE**: Reject request
  - Marks request as rejected with reason
  - Stores rejection reason for audit trail

**Status:** ✅ Created and ready

### 4. Pending Approval Page (EduDashPro)
**File:** `/web/src/app/sign-up/pending-approval/page.tsx`

Features:
- Shows "Registration Submitted" confirmation
- Explains approval process (4-step guide)
- Displays user's email
- Info cards about timeline and next steps
- Support contact information
- Links to homepage and sign-in page

**Status:** ✅ Created and ready

### 5. SuperAdmin Approval UI (EduSitePro)
**File:** `/edusitepro/src/app/admin/organization-requests/page.tsx`

Features:
- Lists all registration requests with filters (all/pending/approved/rejected)
- Card-based view with key info (org name, contact, location, date)
- Detail modal showing complete application
- Approve/Reject buttons with confirmation
- Real-time status updates
- Tracks approval history and IDs

**Status:** ✅ Created and ready

### 6. Updated Principal Registration Form (EduDashPro)
**File:** `/web/src/app/sign-up/principal/page.tsx`

Changes:
- Changed API endpoint from local to EduSitePro:
  - From: `/api/auth/sign-up-principal`
  - To: `${process.env.NEXT_PUBLIC_EDUSITEPRO_API_URL}/api/organizations/register`
- Changed redirect from `/sign-up/verify-email` to `/sign-up/pending-approval`
- Updated error messages to reflect approval workflow

**Status:** ✅ Updated and ready

## Environment Variables Required

### EduDashPro (.env or .env.local)

```bash
# EduSitePro Integration (for organization registration workflow)
NEXT_PUBLIC_EDUSITEPRO_API_URL=http://localhost:3002
# Production: https://edusitepro.edudashpro.org.za
```

### EduSitePro (.env or .env.local)

```bash
# Existing Supabase config (EduSitePro database - DB2)
NEXT_PUBLIC_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=REDACTED

# EduDashPro Database (for cross-database sync during approval - DB1)
EDUDASH_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
EDUDASH_SERVICE_ROLE_KEY=your_edudash_service_role_key

# Internal API Key (for secure API bridges between apps)
INTERNAL_API_KEY=generate_a_secure_random_key_here
```

**Note:** The `.env.example` files have been updated with these variables. You need to:
1. Copy `.env.example` to `.env` (or `.env.local`)
2. Fill in the actual values (especially service role keys)

## Dependencies Installed

### EduSitePro
- ✅ `bcryptjs` - For password hashing during approval workflow
- ✅ `@types/bcryptjs` - TypeScript definitions (not needed, bcryptjs has built-in types)

## Setup Instructions

### Step 1: Apply Database Migration (EduSitePro)

Navigate to EduSitePro directory:

```bash
cd /home/king/Desktop/edusitepro
```

Apply the migration:

```bash
# Option A: Using Supabase CLI (recommended)
npx supabase migration up

# Option B: Using SQL directly in Supabase Dashboard
# Copy contents of /edusitepro/supabase/migrations/20251201000002_organization_registration_requests.sql
# and execute in SQL Editor
```

Verify the table was created:

```bash
npx supabase db diff
```

Expected output: No differences (migration applied successfully)

### Step 2: Configure Environment Variables

**EduDashPro:**

```bash
cd /home/king/Desktop/edudashpro
cp .env.example .env
# Edit .env and set:
# NEXT_PUBLIC_EDUSITEPRO_API_URL=http://localhost:3002
```

**EduSitePro:**

```bash
cd /home/king/Desktop/edusitepro
cp .env.example .env
# Edit .env and set:
# EDUDASH_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
# EDUDASH_SERVICE_ROLE_KEY=<get from EduDashPro Supabase dashboard>
# INTERNAL_API_KEY=<generate a secure random string>
```

To get the service role key:
1. Go to EduDashPro Supabase project: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi
2. Navigate to Settings → API
3. Copy the `service_role` key (it's a JWT token, not the anon key!)

To generate a secure internal API key:

```bash
openssl rand -hex 32
```

### Step 3: Start Development Servers

**Terminal 1 - EduDashPro:**

```bash
cd /home/king/Desktop/edudashpro/web
npm run dev
```

Should run on: http://localhost:3000

**Terminal 2 - EduSitePro:**

```bash
cd /home/king/Desktop/edusitepro
npm run dev
```

Should run on: http://localhost:3002

### Step 4: Test the Workflow

1. **Submit Registration:**
   - Go to: http://localhost:3000/sign-up/principal
   - Fill out all 4 steps of the registration form
   - Submit and verify redirect to pending approval page

2. **Verify Request in Database:**
   - Go to EduSitePro Supabase Dashboard
   - Check `organization_registration_requests` table
   - Should see your request with status='pending'

3. **Approve Request:**
   - Go to: http://localhost:3002/admin/organization-requests
   - Find your pending request
   - Click "Approve" button
   - Verify success message with both organization IDs

4. **Verify Cross-Database Sync:**
   - **EduSitePro DB:** Check `organizations` and `centres` tables
   - **EduDashPro DB:** Check `organizations` and `preschools` tables
   - Verify same UUID used in both databases

5. **Test Sign-In:**
   - Go to: http://localhost:3000/sign-in
   - Sign in with approved credentials
   - Should successfully authenticate

## Database Schema

### organization_registration_requests (EduSitePro DB)

```sql
CREATE TABLE organization_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Personal Information
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  id_number TEXT NOT NULL,
  
  -- Organization Information
  organization_name TEXT NOT NULL,
  organization_slug TEXT NOT NULL UNIQUE,
  organization_type TEXT NOT NULL,
  registration_number TEXT,
  tax_number TEXT,
  
  -- Organization Address
  street_address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'South Africa',
  
  -- Campus Information
  campus_name TEXT NOT NULL,
  campus_slug TEXT NOT NULL,
  campus_address TEXT NOT NULL,
  campus_city TEXT NOT NULL,
  campus_province TEXT NOT NULL,
  campus_postal_code TEXT NOT NULL,
  
  -- Approval Workflow
  status TEXT NOT NULL DEFAULT 'pending',
  approval_notes TEXT,
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  edusitepro_org_id UUID,
  edudashpro_org_id UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);
```

## Security Considerations

### Row-Level Security (RLS)

The migration includes RLS policies:

1. **SuperAdmin Full Access:** SuperAdmins can view/update all requests
2. **Public Insert:** Anyone can submit registration (status auto-set to 'pending')
3. **User View Own:** Users can view their own requests
4. **Immutable Status:** Only SuperAdmins can change status after creation

### Password Storage

- Passwords are hashed with bcrypt (salt rounds: 10) before storage
- Stored temporarily in `organization_registration_requests.password_hash`
- Used only during approval to create auth users
- Not exposed in API responses
- Consider adding password expiry (e.g., reject if not approved within 7 days)

### API Security

- Service role keys used for cross-database operations
- RLS bypassed only for approved SuperAdmin actions
- Internal API key for secure communication between apps (to be implemented)
- Error messages sanitized (no SQL errors exposed to client)

## Known Limitations & Future Improvements

### Current Limitations

1. **No Email Notifications:** Users must manually check approval status
2. **No SuperAdmin Authentication:** Admin UI not protected (anyone can access)
3. **No Request Expiry:** Pending requests stay indefinitely
4. **No Duplicate Detection:** Same person can submit multiple requests
5. **No Audit Trail:** Changes not logged in detail
6. **Single Approval:** No multi-stage approval workflow

### Recommended Improvements

1. **Email Notifications:**
   - Send confirmation email on submission
   - Send approval/rejection notification
   - Implement using Resend or Supabase Edge Functions

2. **Admin Authentication:**
   - Add authentication to `/admin/organization-requests` route
   - Check user role (must be SuperAdmin)
   - Use middleware or server-side check

3. **Request Management:**
   - Auto-expire requests after 7 days
   - Add "Pending Review" and "Under Review" statuses
   - Support request editing (before approval)
   - Allow users to view their request status

4. **Enhanced Validation:**
   - Verify ID number format (South African ID)
   - Validate tax/registration numbers
   - Check organization name uniqueness across both databases
   - Verify email domain (no disposable emails)

5. **Audit & Compliance:**
   - Log all approval/rejection actions
   - Track who approved what and when
   - Export audit trail for compliance
   - Add notes/comments system for approvers

6. **Multi-Stage Approval:**
   - Level 1: Automated checks (duplicates, format validation)
   - Level 2: Human review by SuperAdmin
   - Level 3: Final approval by Platform Owner
   - Support delegation and reassignment

7. **Rollback Support:**
   - Allow "Unapprove" action with reason
   - Soft-delete organizations instead of hard delete
   - Support data recovery

## API Endpoints

### POST /api/organizations/register

Submit a new organization registration request.

**Request Body:**
```json
{
  "email": "principal@school.com",
  "password": "SecurePassword123!",
  "fullName": "Jane Smith",
  "phoneNumber": "+27123456789",
  "idNumber": "8001015009087",
  "organizationName": "Happy Kids Preschool",
  "organizationSlug": "happy-kids",
  "organizationType": "preschool",
  "registrationNumber": "2024/123456/08",
  "taxNumber": "9876543210",
  "streetAddress": "123 Main Street",
  "suburb": "Sandton",
  "city": "Johannesburg",
  "province": "Gauteng",
  "postalCode": "2196",
  "country": "South Africa",
  "campusName": "Main Campus",
  "campusSlug": "main",
  "campusAddress": "123 Main Street, Sandton",
  "campusCity": "Johannesburg",
  "campusProvince": "Gauteng",
  "campusPostalCode": "2196"
}
```

**Success Response:**
```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Registration submitted successfully. Awaiting approval."
}
```

**Error Response:**
```json
{
  "error": "Email already exists",
  "field": "email"
}
```

### POST /api/organizations/approve/[requestId]

Approve a registration request (SuperAdmin only).

**Response:**
```json
{
  "success": true,
  "edusiteproOrgId": "550e8400-e29b-41d4-a716-446655440000",
  "edudashproOrgId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Organization approved and synced to both databases"
}
```

### DELETE /api/organizations/approve/[requestId]

Reject a registration request.

**Request Body:**
```json
{
  "reason": "Invalid registration number"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request rejected successfully"
}
```

## Testing Checklist

- [ ] Migration applied to EduSitePro database
- [ ] Environment variables configured in both apps
- [ ] Both dev servers running (ports 3000 and 3002)
- [ ] Can access registration form at /sign-up/principal
- [ ] Form submits successfully
- [ ] Pending approval page displays correctly
- [ ] Request appears in organization_registration_requests table
- [ ] Can access SuperAdmin UI at /admin/organization-requests
- [ ] Approve button creates organizations in both databases
- [ ] Same UUID used across both databases
- [ ] Auth users created in both Supabase instances
- [ ] User profiles created with correct roles
- [ ] Can sign in with approved credentials
- [ ] Reject button works with reason
- [ ] Filters work (pending/approved/rejected)
- [ ] Detail modal shows all information
- [ ] Error handling works for edge cases

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution:** The table might already exist from a previous attempt. Drop it first:

```sql
DROP TABLE IF EXISTS organization_registration_requests CASCADE;
```

Then rerun the migration.

### Issue: "Service role key not found" error

**Solution:** Make sure you're using the `service_role` key, not the `anon` key. Service role keys are longer JWT tokens and have elevated permissions.

### Issue: CORS errors when calling EduSitePro API from EduDashPro

**Solution:** Add CORS headers to API route in EduSitePro:

```typescript
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

### Issue: Organizations created in one database but not the other

**Solution:** This indicates a failure during cross-database sync. Check:
1. EDUDASH_SUPABASE_URL is correct
2. EDUDASH_SERVICE_ROLE_KEY is valid
3. RLS policies allow service role access
4. Network connectivity between apps
5. Check API route logs for detailed error

### Issue: Can't access SuperAdmin UI

**Solution:** The UI is currently unprotected. In production, you MUST add authentication:

```typescript
// Add at top of page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OrganizationRequestsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect('/sign-in');
  
  // Check if user is SuperAdmin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'super_admin') {
    redirect('/unauthorized');
  }
  
  // ... rest of component
}
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update environment variables with production URLs
- [ ] Apply migration to production EduSitePro database
- [ ] Add SuperAdmin authentication to admin UI
- [ ] Implement email notifications
- [ ] Add rate limiting to registration endpoint
- [ ] Configure CORS properly
- [ ] Test with real data
- [ ] Set up monitoring and alerts
- [ ] Create runbook for support team
- [ ] Train SuperAdmins on approval process

### Production Environment Variables

**EduDashPro:**
```bash
NEXT_PUBLIC_EDUSITEPRO_API_URL=https://edusitepro.edudashpro.org.za
```

**EduSitePro:**
```bash
EDUDASH_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
EDUDASH_SERVICE_ROLE_KEY=<production_service_role_key>
INTERNAL_API_KEY=<strong_random_key_for_production>
```

### Monitoring

Set up monitoring for:
- Registration submission rate
- Approval time (median/p95)
- Rejection rate and reasons
- Cross-database sync failures
- API error rates
- User complaints about pending approvals

## Support & Maintenance

### SuperAdmin Training

SuperAdmins should be trained on:
1. How to review registration requests
2. What to look for (red flags, duplicates)
3. When to approve vs reject
4. How to write helpful rejection reasons
5. What to do if approval fails
6. How to contact support

### Common Rejection Reasons

- Invalid or incomplete information
- Duplicate organization name
- Suspected fraud or spam
- Does not meet eligibility criteria
- Organization already exists in system
- Contact information not verifiable

### Escalation Path

If technical issues occur during approval:
1. Check Supabase logs in both databases
2. Verify RLS policies are correct
3. Check API route logs
4. Verify service role keys are valid
5. Contact platform engineering team

---

## Summary

This implementation provides a complete SuperAdmin approval workflow for organization registrations. The system:

1. ✅ Captures complete organization details from users
2. ✅ Stores requests in pending state
3. ✅ Provides SuperAdmin UI for review and approval
4. ✅ Syncs approved organizations to both databases
5. ✅ Creates auth users and profiles in both systems
6. ✅ Uses same UUID across databases for referential integrity
7. ✅ Handles errors gracefully with rollback
8. ✅ Provides clear feedback to users

**Next Steps:**
1. Apply database migration
2. Configure environment variables
3. Test end-to-end workflow
4. Add SuperAdmin authentication
5. Implement email notifications
6. Deploy to production

For questions or issues, contact: support@edudashpro.org.za
