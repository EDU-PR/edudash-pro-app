# Young Eagles → EduDash Pro Integration Plan

## Current State Analysis

### Young Eagles Website (`youngeagles-education-platform`)
- **Tech Stack**: React + Vite + Firebase
- **Domain**: `youngeagles.org.za` (or similar)
- **Features**:
  - Marketing website with Programs, About, Contact pages
  - `Register2026Modal` component for student registration
  - Firebase for backend data storage
  - Static registration form that saves to Firebase

### EduDash Pro (`edudashpro`)
- **Tech Stack**: Next.js 15 + React Native (Expo) + Supabase
- **Database**: Multi-tenant PostgreSQL with RLS (bppuzibjlxgfwrujzfsz)
- **Features**:
  - Multi-tenant SaaS platform
  - Principal/Admin dashboards
  - `ChildRegistrationWidget` for approving requests
  - `registration_requests` table for student intake
  - Full student management system

### EduSitePro (`edusitepro`)
- **Tech Stack**: Next.js 14 + Supabase
- **Purpose**: Website builder for tenants
- **Status**: Separate repo, appears to be for building custom tenant sites

---

## Integration Strategy

### Option 1: Migrate Young Eagles to EduDash Pro Tenant (RECOMMENDED)

**Overview**: Make Young Eagles a full tenant within EduDash Pro's multi-tenant system while keeping its own domain.

#### Step 1: Create Young Eagles Organization in EduDash Pro Database

```sql
-- Already exists in QUICK_START.sh - verify/update:
INSERT INTO organizations (
  id,
  name,
  slug,
  school_code,
  domain,
  type,
  status,
  tier,
  max_students,
  max_teachers
) VALUES (
  '00000000-0000-0000-0000-000000000002', -- Fixed UUID for Young Eagles
  'Young Eagles Preschool',
  'young-eagles',
  'YE-2026',
  'youngeagles.org.za',
  'ecd', -- Early Childhood Development
  'active',
  'enterprise',
  200,
  50
);
```

#### Step 2: Set Up Domain Routing

**DNS Configuration**:
```
youngeagles.org.za → CNAME → edudashpro.org.za
or
youngeagles.org.za → A Record → EduDash Pro server IP
```

**Next.js Middleware** (`web/src/middleware.ts`):
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Young Eagles custom domain
  if (hostname === 'youngeagles.org.za' || hostname.includes('youngeagles')) {
    const url = request.nextUrl.clone();
    url.searchParams.set('tenant', 'young-eagles');
    return NextResponse.rewrite(url);
  }
  
  // Default EduDash Pro
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

#### Step 3: Replace Young Eagles Firebase with Supabase

**Current `Register2026Modal` Flow**:
```jsx
// youngeagles-education-platform/src/components/Register2026Modal.jsx
const handleSubmit = async (e) => {
  await DatabaseService.addRegistration(formData); // → Firebase
};
```

**New Integration**:
```jsx
// Replace DatabaseService with Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bppuzibjlxgfwrujzfsz.supabase.co',
  'YOUR_ANON_KEY'
);

const handleSubmit = async (e) => {
  e.preventDefault();
  
  const { data, error } = await supabase
    .from('child_registration_requests')
    .insert({
      preschool_id: '00000000-0000-0000-0000-000000000002', // Young Eagles ID
      parent_email: formData.parentEmail,
      parent_name: formData.parentName,
      parent_phone: formData.parentPhone,
      child_first_name: formData.childName.split(' ')[0],
      child_last_name: formData.childName.split(' ').slice(1).join(' '),
      child_birth_date: calculateBirthDate(formData.childAge), // Helper function
      child_gender: formData.childGender,
      requested_date: new Date().toISOString(),
      status: 'pending',
      notes: `Program: ${formData.preferredProgram}\nAdditional: ${formData.additionalNotes}`,
    });
    
  if (error) {
    toast.error('Registration failed. Please try again.');
  } else {
    toast.success('Registration submitted! We\'ll contact you soon.');
    onClose();
  }
};
```

#### Step 4: Admin Access for Young Eagles Staff

**Create Admin Users**:
```sql
-- Example: Create admin@youngeagles.org.za
-- This user will have access to:
-- 1. Principal dashboard at /dashboard/principal
-- 2. ChildRegistrationWidget showing Young Eagles registrations only
-- 3. Student management, classes, attendance, etc.

-- User will be created via Supabase Auth signup
-- Then link to organization:
UPDATE profiles 
SET 
  preschool_id = '00000000-0000-0000-0000-000000000002',
  role = 'principal'
WHERE email = 'admin@youngeagles.org.za';
```

**RLS Policy Ensures Isolation**:
```sql
-- Existing policy in child_registration_requests table:
CREATE POLICY "Users see own org data" ON child_registration_requests
FOR SELECT
USING (
  preschool_id IN (
    SELECT preschool_id FROM profiles WHERE id = auth.uid()
  )
);

-- This means:
-- admin@youngeagles.org.za only sees registrations for Young Eagles
-- admin@edudashpro.org.za only sees registrations for Main School
-- Full data isolation!
```

#### Step 5: Update Young Eagles Website

**File**: `youngeagles-education-platform/src/pages/Home.jsx`

```jsx
// BEFORE
<a href="https://edusitepro.edudashpro.org.za/register">
  📝 Register for 2026
</a>

// AFTER - Two options:

// Option A: Keep modal, point to Supabase
<button onClick={() => setShowRegisterModal(true)}>
  📝 Register for 2026
</button>
<Register2026Modal 
  isOpen={showRegisterModal}
  onClose={() => setShowRegisterModal(false)}
  organizationId="00000000-0000-0000-0000-000000000002"
/>

// Option B: Redirect to EduDash Pro hosted form
<a href="https://youngeagles.org.za/register">
  📝 Register for 2026
</a>
// This goes to a Next.js page in EduDash Pro that shows PublicRegistrationForm
```

---

## Implementation Steps

### Phase 1: Database Setup (1 hour)
- [ ] Verify Young Eagles organization exists in Supabase
- [ ] Create admin user: `admin@youngeagles.org.za`
- [ ] Link user to organization with `preschool_id`
- [ ] Grant `principal` role
- [ ] Test RLS policies

### Phase 2: Domain & Routing (2 hours)
- [ ] Configure DNS for `youngeagles.org.za`
- [ ] Update Next.js middleware for tenant routing
- [ ] Add custom domain support in Vercel/deployment
- [ ] Test domain routing

### Phase 3: Frontend Integration (3 hours)
- [ ] Install `@supabase/supabase-js` in youngeagles-education-platform
- [ ] Replace `DatabaseService` with Supabase client
- [ ] Update `Register2026Modal` to use `child_registration_requests` table
- [ ] Add environment variables:
  ```
  VITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
  VITE_SUPABASE_ANON_KEY=your_anon_key_here
  VITE_ORGANIZATION_ID=00000000-0000-0000-0000-000000000002
  ```
- [ ] Test registration form submission

### Phase 4: Admin Dashboard Access (1 hour)
- [ ] Create login credentials for Young Eagles admin
- [ ] Test principal dashboard access
- [ ] Verify ChildRegistrationWidget shows only Young Eagles data
- [ ] Test approval workflow (approve → create student)
- [ ] Test student management features

### Phase 5: Testing & Validation (2 hours)
- [ ] Submit test registration from youngeagles.org.za
- [ ] Verify it appears in admin dashboard
- [ ] Test approval process
- [ ] Verify student is created correctly
- [ ] Test RLS isolation (admin can't see other schools' data)
- [ ] Test calendar builder, reports, etc.

---

## Alternative: EduSitePro Integration

If you want to use the website builder (`edusitepro`):

### Option 2: Build Young Eagles Site with EduSitePro

1. **Create tenant site in EduSitePro**
2. **Use website builder** to create custom pages
3. **Add registration form block** using `RegistrationFormBlock`
4. **Deploy to custom domain** `youngeagles.org.za`

**Pros**:
- No-code site management for Young Eagles
- Built-in registration forms
- Consistent branding

**Cons**:
- Requires migrating current React site to builder
- Loses custom React components/animations
- More setup time

---

## Data Flow Diagram

```
┌─────────────────────────────────┐
│  youngeagles.org.za             │
│  (React Vite Site)              │
│  ┌─────────────────────────┐    │
│  │  Register2026Modal      │    │
│  │  - Parent fills form    │    │
│  │  - Clicks Submit        │    │
│  └──────────┬──────────────┘    │
└─────────────┼───────────────────┘
              │
              │ Supabase Insert
              ▼
┌─────────────────────────────────┐
│  Supabase Database              │
│  (bppuzibjlxgfwrujzfsz)         │
│  ┌─────────────────────────┐    │
│  │ child_registration_     │    │
│  │ requests                │    │
│  │ - preschool_id: YE-UUID │    │
│  │ - status: pending       │    │
│  └─────────────────────────┘    │
└─────────────┬───────────────────┘
              │
              │ RLS filters by org
              ▼
┌─────────────────────────────────┐
│  edudashpro.org.za/dashboard    │
│  /principal                     │
│  ┌─────────────────────────┐    │
│  │  ChildRegistrationWidget│    │
│  │  - Shows YE requests    │    │
│  │  - Admin approves       │    │
│  │  - Creates student      │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

---

## Environment Variables

### Young Eagles Website
```env
# .env in youngeagles-education-platform/
VITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...  # Get from Supabase dashboard
VITE_ORGANIZATION_ID=00000000-0000-0000-0000-000000000002
VITE_SCHOOL_CODE=YE-2026
```

### EduDash Pro (already configured)
```env
# web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Code Changes Required

### File: `youngeagles-education-platform/src/lib/supabase.js` (NEW)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const ORGANIZATION_ID = import.meta.env.VITE_ORGANIZATION_ID;
```

### File: `youngeagles-education-platform/src/components/Register2026Modal.jsx`
```javascript
import { supabase, ORGANIZATION_ID } from '../lib/supabase';

// Inside handleSubmit:
const { data, error } = await supabase
  .from('child_registration_requests')
  .insert({
    preschool_id: ORGANIZATION_ID,
    parent_email: formData.parentEmail,
    parent_name: formData.parentName,
    parent_phone: formData.parentPhone,
    child_first_name: formData.childName.split(' ')[0],
    child_last_name: formData.childName.split(' ').slice(1).join(' '),
    child_birth_date: new Date(new Date().getFullYear() - formData.childAge, 0, 1).toISOString().split('T')[0],
    child_gender: formData.childGender?.toLowerCase(),
    requested_date: new Date().toISOString(),
    status: 'pending',
    notes: `Preferred Program: ${formData.preferredProgram}\nInterested in PWA: ${formData.interestedInPWA}\nAdditional Notes: ${formData.additionalNotes}`
  });
```

### File: `youngeagles-education-platform/package.json`
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.75.0",
    // ... existing deps
  }
}
```

---

## Security Considerations

### RLS Policies Already in Place
✅ `child_registration_requests` has RLS for tenant isolation
✅ Admin users can only see their organization's data
✅ Anon key is safe for frontend (RLS enforced server-side)
✅ Service role key never exposed to frontend

### Additional Security
- Rate limiting on registration endpoint
- Email verification for admins
- CAPTCHA on public form (optional)
- Audit logs for approvals

---

## Benefits of This Integration

1. **Data Centralization**: All student data in one database
2. **Admin Dashboard**: Young Eagles staff use professional EduDash Pro dashboard
3. **Automation**: Approval workflow, notifications, reports
4. **Scalability**: Add more schools/branches easily
5. **Domain Flexibility**: Keep `youngeagles.org.za` branding
6. **Security**: Enterprise-grade RLS and auth
7. **Analytics**: Unified reporting across all tenants
8. **Cost**: Shared infrastructure, lower per-school cost

---

## Next Steps

1. **Decision**: Confirm Young Eagles wants full EduDash Pro integration
2. **Access**: Provide Supabase anon key for frontend
3. **Code Changes**: Update `Register2026Modal.jsx` (15 minutes)
4. **Deploy**: Build and deploy youngeagles-education-platform
5. **Create Admin**: Set up `admin@youngeagles.org.za` account
6. **Test**: Submit test registration, approve in dashboard
7. **Go Live**: Point youngeagles.org.za to production

**Estimated Total Time**: 6-8 hours for full integration

---

## Support & Maintenance

- EduDash Pro team maintains core platform
- Young Eagles maintains their marketing website styling
- Registration data flows automatically to dashboard
- Updates to forms/workflows apply to all tenants
- Young Eagles can customize their branding/colors

---

## Questions to Answer

1. Does Young Eagles want to keep the current Vite React site?
2. Should we migrate to EduSitePro website builder instead?
3. What domain should they use? (youngeagles.org.za recommended)
4. Who will be the admin users?
5. Do they need custom branding in the dashboard?
6. Should we keep Firebase for anything else, or full migration?

---

*Last Updated: November 19, 2025*
