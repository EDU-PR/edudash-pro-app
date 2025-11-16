# Student Registration Integration for EduSitePro Website Builder

## Overview
This document explains how the student registration system integrates with the EduSitePro website builder, allowing any tenant to add a registration form to their custom website.

---

## Architecture

### Database Layer (Supabase - bppuzibjlxgfwrujzfsz)
- **Multi-tenant isolation** via `organization_id` foreign keys
- **Row-Level Security (RLS)** ensures data segregation
- **Tables created**:
  - `registration_requests` - Public registration intake
  - `students` - Enrolled student records
  - `student_guardians` - Parent/guardian relationships
  - `classes` - Class/grade management
  - `preschools` - Campus/location management
  - `attendance` - Daily attendance tracking
  - `student_fees` - Payment management
  - `communication_log` - Email/SMS notifications

### Frontend Components (React/Next.js)
Located in `/media/king/Desktop/edudashpro/web/src/components/registration/`

1. **PublicRegistrationForm.tsx** - Embeddable registration form
2. **RegistrationDashboard.tsx** - Admin approval interface
3. **StudentManagement.tsx** - Enrolled student management
4. **ClassManager.tsx** - Class assignment interface

### API Layer (Supabase Functions + Next.js API Routes)
- `/api/registration/submit` - Handle form submissions
- `/api/registration/approve` - Approve/reject requests
- `/api/students/enroll` - Convert approved request to student
- `/api/notifications/send` - Email/SMS notifications

---

## Implementation Guide

### Phase 1: Add Registration to Website Builder

#### 1.1 Create Registration Component Block

**File**: `web/src/components/website-builder/blocks/RegistrationFormBlock.tsx`

```typescript
import { PublicRegistrationForm } from '@/components/registration/PublicRegistrationForm';

export function RegistrationFormBlock({ organizationId, schoolCode }: {
  organizationId: string;
  schoolCode: string;
}) {
  return (
    <div className="registration-block">
      <PublicRegistrationForm 
        organizationId={organizationId}
        schoolCode={schoolCode}
      />
    </div>
  );
}
```

#### 1.2 Register Block in Website Builder

**File**: `web/src/lib/website-builder/block-registry.ts`

```typescript
export const AVAILABLE_BLOCKS = {
  // ... existing blocks
  registration_form: {
    id: 'registration_form',
    name: 'Student Registration Form',
    category: 'forms',
    icon: '📝',
    component: RegistrationFormBlock,
    defaultProps: {
      title: '2026 Student Registration',
      showDocumentUpload: true,
      requireIdNumber: false,
    },
    requiredData: ['organizationId', 'schoolCode'],
    description: 'Allow parents to register students for upcoming academic year',
  },
};
```

#### 1.3 Add to Drag-and-Drop Interface

**File**: `web/src/components/website-builder/BlockPalette.tsx`

```typescript
<BlockItem
  icon="📝"
  title="Registration Form"
  description="Student enrollment form"
  blockType="registration_form"
  onDragStart={() => handleDragStart('registration_form')}
/>
```

---

### Phase 2: Public Registration Form Component

**File**: `web/src/components/registration/PublicRegistrationForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface RegistrationFormProps {
  organizationId: string;
  schoolCode: string;
}

export function PublicRegistrationForm({ organizationId, schoolCode }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Guardian info
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    guardianIdNumber: '',
    guardianAddress: '',
    
    // Student info
    studentFirstName: '',
    studentLastName: '',
    studentDob: '',
    studentGender: '',
    
    // Registration details
    preferredClass: '',
    preferredStartDate: '',
    specialRequests: '',
    howDidYouHear: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('registration_requests')
        .insert({
          organization_id: organizationId,
          guardian_name: formData.guardianName,
          guardian_email: formData.guardianEmail,
          guardian_phone: formData.guardianPhone,
          guardian_id_number: formData.guardianIdNumber,
          guardian_address: formData.guardianAddress,
          student_first_name: formData.studentFirstName,
          student_last_name: formData.studentLastName,
          student_dob: formData.studentDob,
          student_gender: formData.studentGender,
          preferred_class: formData.preferredClass,
          preferred_start_date: formData.preferredStartDate,
          special_requests: formData.specialRequests,
          how_did_you_hear: formData.howDidYouHear,
          academic_year: '2026',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'registration_confirmation',
          to: formData.guardianEmail,
          data: {
            studentName: `${formData.studentFirstName} ${formData.studentLastName}`,
            schoolCode: schoolCode,
            requestId: data.id,
          },
        }),
      });

      toast.success('Registration submitted successfully! Check your email for confirmation.');
      
      // Reset form
      setFormData({
        guardianName: '',
        guardianEmail: '',
        guardianPhone: '',
        guardianIdNumber: '',
        guardianAddress: '',
        studentFirstName: '',
        studentLastName: '',
        studentDob: '',
        studentGender: '',
        preferredClass: '',
        preferredStartDate: '',
        specialRequests: '',
        howDidYouHear: '',
      });
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="registration-form">
      <h2>Student Registration for 2026</h2>
      
      {/* Guardian Information Section */}
      <section>
        <h3>Parent/Guardian Information</h3>
        <input
          type="text"
          placeholder="Full Name"
          value={formData.guardianName}
          onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email Address"
          value={formData.guardianEmail}
          onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
          required
        />
        <input
          type="tel"
          placeholder="Phone Number"
          value={formData.guardianPhone}
          onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
          required
        />
        {/* Add more guardian fields */}
      </section>

      {/* Student Information Section */}
      <section>
        <h3>Student Information</h3>
        <input
          type="text"
          placeholder="First Name"
          value={formData.studentFirstName}
          onChange={(e) => setFormData({ ...formData, studentFirstName: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Last Name"
          value={formData.studentLastName}
          onChange={(e) => setFormData({ ...formData, studentLastName: e.target.value })}
          required
        />
        <input
          type="date"
          placeholder="Date of Birth"
          value={formData.studentDob}
          onChange={(e) => setFormData({ ...formData, studentDob: e.target.value })}
          required
        />
        {/* Add more student fields */}
      </section>

      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Registration'}
      </button>
    </form>
  );
}
```

---

### Phase 3: Admin Dashboard for Registration Approval

**File**: `web/src/components/registration/RegistrationDashboard.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function RegistrationDashboard({ organizationId }: { organizationId: string }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, [organizationId]);

  const fetchRequests = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('organization_id', organizationId)
      .order('submission_date', { ascending: false });

    if (!error) setRequests(data || []);
    setLoading(false);
  };

  const handleApprove = async (requestId: string) => {
    const supabase = createClient();
    
    // Update request status
    await supabase
      .from('registration_requests')
      .update({
        status: 'approved',
        reviewed_date: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', requestId);

    // Send approval email
    // ...

    fetchRequests();
  };

  const handleReject = async (requestId: string, reason: string) => {
    const supabase = createClient();
    
    await supabase
      .from('registration_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_date: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', requestId);

    // Send rejection email
    // ...

    fetchRequests();
  };

  return (
    <div className="registration-dashboard">
      <h2>Registration Requests</h2>
      
      <div className="filters">
        <button>All</button>
        <button>Pending</button>
        <button>Approved</button>
        <button>Rejected</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Guardian</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>{req.student_first_name} {req.student_last_name}</td>
              <td>{req.guardian_name}</td>
              <td>{new Date(req.submission_date).toLocaleDateString()}</td>
              <td><span className={`status-${req.status}`}>{req.status}</span></td>
              <td>
                {req.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(req.id)}>Approve</button>
                    <button onClick={() => handleReject(req.id, 'Capacity full')}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Website Builder Usage

### For Tenant Admins (e.g., Young Eagles)

1. **Log in to EduSitePro** as principal/admin
2. **Navigate to Website Builder**
3. **Drag "Registration Form" block** to desired page
4. **Configure settings**:
   - Title: "2026 Student Registration"
   - Academic Year: 2026
   - Preferred Class Options: ["Grade R", "Reception", "Pre-Primary"]
   - Enable Document Upload: Yes
   - Require ID Number: Optional
5. **Publish website**

The registration form will now be live at:
`https://young-eagles.edusitepro.com/register`

---

## Data Flow

### Registration Submission Flow

```
1. Parent visits: young-eagles.edusitepro.com/register
   ↓
2. Fills out PublicRegistrationForm
   ↓
3. Form data submitted to Supabase:
   INSERT INTO registration_requests
   ↓
4. Email confirmation sent to parent
   ↓
5. Admin notification sent to principal
   ↓
6. Request appears in RegistrationDashboard (pending)
```

### Approval Flow

```
1. Principal logs in to EduSitePro dashboard
   ↓
2. Views RegistrationDashboard
   ↓
3. Reviews request details
   ↓
4. Clicks "Approve" or "Reject"
   ↓
5. Status updated in database
   ↓
6. Email sent to parent (approved/rejected)
   ↓
7. If approved: Option to "Enroll Student"
   ↓
8. Student record created in students table
   ↓
9. Guardian relationship created
   ↓
10. Student assigned to class
```

---

## Email Templates

### Registration Confirmation Email

**Subject**: Registration Received - [School Name]

```
Dear [Guardian Name],

Thank you for registering [Student Name] for the 2026 academic year at [School Name].

Registration Details:
- Student: [Student First Name] [Student Last Name]
- Date of Birth: [DOB]
- Preferred Class: [Class]
- Reference Number: [Request ID]

Your application is currently under review. We will notify you within 2-3 business days regarding the status of your application.

If you have any questions, please contact us at:
Email: [Contact Email]
Phone: [Contact Phone]

Thank you,
[School Name] Administration
```

### Approval Email

**Subject**: Registration Approved - [School Name]

```
Dear [Guardian Name],

Congratulations! We are pleased to inform you that [Student Name]'s registration has been approved for the 2026 academic year.

Next Steps:
1. Complete enrollment by [Deadline Date]
2. Upload required documents: [Document List]
3. Pay registration fee: [Amount]

Login to your parent portal to complete enrollment:
[Portal Link]

Welcome to the [School Name] family!

Best regards,
[School Name] Administration
```

---

## Security Considerations

### RLS Policies Implemented

1. **Public Can Submit**: Anyone can insert into `registration_requests`
2. **Guardians View Own**: Parents can only see their own submitted requests
3. **Principals Manage Org**: School admins see only their organization's requests
4. **Teachers View Classes**: Teachers see students in their assigned classes

### Data Validation

- Email validation on frontend and backend
- Phone number formatting
- Date of birth age restrictions (2-6 years for preschool)
- XSS protection on all text inputs
- File upload restrictions (PDF, JPG, PNG only, max 5MB)

---

## Customization Options for Tenants

Each tenant can customize:

1. **Form Fields**:
   - Required vs optional fields
   - Additional custom fields (JSON storage)
   - Field labels and placeholders

2. **Styling**:
   - Colors matching school branding
   - Logo placement
   - Font choices

3. **Workflow**:
   - Auto-approve vs manual review
   - Waitlist management
   - Priority scoring rules

4. **Notifications**:
   - Email templates
   - SMS notifications (optional)
   - Reminder schedules

---

## Performance Optimization

- **Database Indexing**: All foreign keys indexed
- **Pagination**: Large request lists paginated (50 per page)
- **Caching**: Organization data cached client-side
- **Lazy Loading**: Document previews loaded on demand
- **Real-time Updates**: Supabase subscriptions for live dashboard updates

---

## Testing Checklist

- [ ] Submit registration as anonymous parent
- [ ] Verify email confirmation sent
- [ ] Login as principal and view dashboard
- [ ] Approve a registration request
- [ ] Reject a registration request
- [ ] Enroll approved student
- [ ] Assign student to class
- [ ] Verify RLS policies (cannot see other org's data)
- [ ] Test file upload functionality
- [ ] Test mobile responsiveness
- [ ] Load test with 100+ simultaneous submissions

---

## Deployment Steps

1. **Database Migration**:
   ```bash
   psql -f supabase/migrations/20251116_student_registration_2026_schema.sql
   ```

2. **Insert Tenant**:
   ```bash
   bash setup_youngeagles_tenant.sh
   ```

3. **Deploy Frontend**:
   ```bash
   cd web && npm run build && vercel deploy --prod
   ```

4. **Configure Email Service** (SendGrid/Resend):
   - Set API keys in environment variables
   - Create email templates
   - Test email delivery

5. **Test End-to-End**:
   - Submit test registration
   - Verify emails
   - Approve/reject flow

---

## Monitoring & Analytics

Track key metrics:

- **Registration Volume**: Daily/weekly submissions
- **Approval Rate**: % approved vs rejected
- **Time to Decision**: Average review time
- **Conversion Rate**: Approved → enrolled
- **Dropout Points**: Where users abandon form
- **Popular Referral Sources**: "How did you hear about us?"

Dashboard location: `/dashboard/principal/analytics/registrations`

---

## Future Enhancements

- [ ] Payment gateway integration (registration fees)
- [ ] Document verification automation (OCR for ID numbers)
- [ ] Sibling discount auto-calculation
- [ ] Waitlist management with auto-notifications
- [ ] Interview scheduling system
- [ ] Parent portal for status tracking
- [ ] Multi-language support (Afrikaans, Zulu, Xhosa)
- [ ] Mobile app version (React Native)
- [ ] Integration with existing student information systems
- [ ] Automated background checks (if required)

---

## Support & Troubleshooting

### Common Issues

**Issue**: Registration form not appearing on website
- **Solution**: Verify organizationId prop is passed correctly

**Issue**: Emails not sending
- **Solution**: Check SMTP credentials, verify email template exists

**Issue**: Cannot approve registrations
- **Solution**: Verify user has principal role and organization_id matches

**Issue**: RLS policy denying access
- **Solution**: Check auth.uid() matches principal_id in organizations table

---

## Contact

**Technical Support**: dev@edusitepro.com
**Documentation**: https://docs.edusitepro.com/registration
**GitHub**: https://github.com/edusitepro/student-registration

---

*Last Updated: November 16, 2025*
*Version: 1.0.0*
