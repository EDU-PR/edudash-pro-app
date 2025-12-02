# Terms & Conditions Features - Implementation Plan

## Current Status (December 2, 2025)

### ✅ What's Working
- **EduSitePro Registration Form**: Terms checkbox with clickable link
- **Database Storage**: `organizations.terms_and_conditions_url` column stores external URL
- **Young Eagles**: HTML terms page deployed at `https://edusitepro.edudashpro.org.za/terms-young-eagles.html`
- **Dynamic Loading**: Registration form automatically fetches and displays organization's terms URL

### ❌ What's Missing
- Parents cannot view T&Cs from within EduDashPro app
- Principals cannot update T&Cs URL from admin panel
- No inline content editing (must upload HTML/PDF externally)

---

## Phase 1: Parent View (PRIORITY)

### Feature: View Terms & Conditions from EduDashPro App

**User Story**: As a parent, I want to view my school's terms and conditions from the app so I can reference them anytime.

**Implementation**:

#### 1. Mobile App (React Native)
```typescript
// File: components/screens/TermsScreen.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useOrganization } from '@/hooks/useOrganization';

export function TermsScreen() {
  const { organization, loading } = useOrganization();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!organization?.terms_and_conditions_url) {
    return (
      <View style={styles.empty}>
        <Text>No terms and conditions available</Text>
      </View>
    );
  }

  return (
    <WebView 
      source={{ uri: organization.terms_and_conditions_url }}
      style={styles.webview}
      startInLoadingState
      renderLoading={() => <ActivityIndicator />}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
```

#### 2. Navigation Menu Item
```typescript
// File: navigation/ParentNavigator.tsx
{
  name: 'Terms & Conditions',
  screen: 'TermsScreen',
  icon: 'document-text-outline',
  component: TermsScreen,
}
```

#### 3. Web Version (Next.js)
```typescript
// File: web/src/app/dashboard/parent/terms/page.tsx
'use client';

import { useOrganization } from '@/hooks/useOrganization';

export default function TermsPage() {
  const { organization } = useOrganization();

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Terms & Conditions</h1>
      {organization?.terms_and_conditions_url ? (
        <iframe
          src={organization.terms_and_conditions_url}
          className="w-full h-[calc(100vh-120px)] border rounded-lg"
        />
      ) : (
        <p className="text-gray-600">No terms and conditions available</p>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:
- ✅ Parents can access T&Cs from Settings menu
- ✅ WebView/iframe loads organization's terms URL
- ✅ Works offline if terms were previously loaded
- ✅ Graceful error handling if URL invalid
- ✅ Back button returns to previous screen

**Effort**: ~2-3 hours

---

## Phase 2: Principal Management (PRIORITY)

### Feature: Update Terms & Conditions URL from Admin Panel

**User Story**: As a principal, I want to update my school's terms & conditions URL so I can keep policies current without technical assistance.

**Implementation**:

#### 1. School Settings Form
```typescript
// File: web/src/app/dashboard/principal/settings/page.tsx

export default function SchoolSettingsPage() {
  const [termsUrl, setTermsUrl] = useState(organization?.terms_and_conditions_url || '');
  const [saving, setSaving] = useState(false);

  async function handleSaveTermsUrl() {
    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          terms_and_conditions_url: termsUrl 
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      
      toast.success('Terms & Conditions URL updated successfully');
    } catch (error) {
      toast.error('Failed to update Terms URL');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Legal Documents</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Terms & Conditions URL
            </label>
            <input
              type="url"
              value={termsUrl}
              onChange={(e) => setTermsUrl(e.target.value)}
              placeholder="https://yourschool.com/terms.html"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This URL will be shown to parents during registration and accessible in the app
            </p>
          </div>

          {termsUrl && (
            <div>
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Preview Terms & Conditions →
              </a>
            </div>
          )}

          <button
            onClick={handleSaveTermsUrl}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </section>
    </div>
  );
}
```

#### 2. API Endpoint
```typescript
// File: web/src/app/api/organizations/[id]/route.ts

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify principal has permission to update this organization
    const principal = await verifyPrincipal();
    if (!principal || principal.organization_id !== params.id) {
      return forbiddenResponse();
    }

    const { terms_and_conditions_url } = await request.json();

    // Validate URL format
    if (terms_and_conditions_url) {
      try {
        new URL(terms_and_conditions_url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceRoleClient();

    const { error } = await supabase
      .from('organizations')
      .update({
        terms_and_conditions_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Acceptance Criteria**:
- ✅ Principal can update terms URL from Settings page
- ✅ URL validation (must be valid HTTP/HTTPS URL)
- ✅ Preview button opens terms in new tab
- ✅ Changes reflect immediately on registration form
- ✅ Changes visible to parents in app instantly
- ✅ Audit trail (updated_at timestamp)

**Effort**: ~3-4 hours

---

## Phase 3: Rich Text Editor (FUTURE - COMPLEX)

### Feature: Inline Terms & Conditions Content Management

**User Story**: As a principal, I want to edit terms & conditions directly in the admin panel with a rich text editor, so I don't need external hosting or technical knowledge.

**Why This Is Complex**:
1. **Rich Text Editing**: Need robust WYSIWYG editor (TinyMCE, Quill, or Lexical)
2. **Content Storage**: Large text blobs in database, performance implications
3. **Versioning**: Legal requirement - must track all historical versions
4. **Audit Trail**: Who changed what and when
5. **PDF Generation**: Generate downloadable PDF for offline access
6. **Mobile Rendering**: Properly styled HTML in mobile WebView
7. **Approval Workflow**: Changes might need legal review before going live
8. **Multi-language**: Support for multiple languages
9. **Templates**: Pre-built templates for common clauses

**Implementation Outline**:

```typescript
// Database Schema Extensions
CREATE TABLE terms_versions (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  content TEXT NOT NULL,
  version INT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft', -- draft, approved, archived
  change_summary TEXT
);

// Rich Text Editor Component
import { Editor } from '@tinymce/tinymce-react';

function TermsEditor() {
  const [content, setContent] = useState('');
  
  return (
    <Editor
      apiKey="your-tinymce-key"
      value={content}
      init={{
        height: 600,
        menubar: true,
        plugins: ['advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview'],
        toolbar: 'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist',
      }}
      onEditorChange={(newContent) => setContent(newContent)}
    />
  );
}

// Version History Component
function TermsVersionHistory({ organizationId }: { organizationId: string }) {
  const [versions, setVersions] = useState<TermsVersion[]>([]);
  
  return (
    <div>
      <h3>Version History</h3>
      {versions.map((version) => (
        <div key={version.id}>
          <span>v{version.version}</span>
          <span>{new Date(version.created_at).toLocaleString()}</span>
          <span>{version.created_by_name}</span>
          <button onClick={() => revertToVersion(version.id)}>Revert</button>
          <button onClick={() => viewVersion(version.id)}>View</button>
        </div>
      ))}
    </div>
  );
}

// PDF Generation (Server-side)
import puppeteer from 'puppeteer';

async function generateTermsPDF(content: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; }
          p { line-height: 1.6; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });
  
  await browser.close();
  return pdf;
}
```

**Additional Features**:
- **Draft Mode**: Save drafts without publishing
- **Scheduled Publishing**: Set future date for changes to go live
- **Change Notifications**: Notify parents when T&Cs are updated
- **Acceptance Tracking**: Track which parents have acknowledged updated terms
- **Comparison View**: Side-by-side diff of old vs new versions
- **Export Options**: PDF, DOCX, HTML download

**Effort**: ~40-60 hours (2-3 weeks)

**Dependencies**:
- TinyMCE or similar editor license (~$500/year)
- PDF generation library (Puppeteer or similar)
- Additional database tables and migrations
- Comprehensive testing for legal compliance

**Risks**:
- Legal liability if version control fails
- Performance issues with large content
- Mobile rendering inconsistencies
- Security concerns (XSS attacks via HTML content)

**Recommendation**: 
Start with **Phase 1 & 2** (simple URL management). Only implement Phase 3 if:
1. You have multiple schools requesting it
2. Budget allocated for proper legal review
3. Dedicated dev time for robust testing
4. Clear compliance requirements documented

---

## Database Schema (Current)

```sql
-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  terms_and_conditions_url VARCHAR(500),  -- External URL (Phase 1 & 2)
  terms_and_conditions_text TEXT,         -- Inline content (Phase 3 - Future)
  registration_open BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW(),
  -- ... other columns
);
```

**No schema changes needed for Phase 1 & 2!** ✅

---

## Testing Checklist

### Phase 1 - Parent View
- [ ] Parent can access T&Cs from mobile app menu
- [ ] WebView loads correctly on iOS
- [ ] WebView loads correctly on Android
- [ ] Web version iframe loads correctly
- [ ] Error handling for invalid/missing URL
- [ ] Back button navigation works
- [ ] Loading state displays properly

### Phase 2 - Principal Management
- [ ] Principal can update URL in settings
- [ ] URL validation prevents invalid entries
- [ ] Preview button opens correct URL
- [ ] Changes save to database
- [ ] Changes reflect on registration form immediately
- [ ] Unauthorized users cannot update other schools' URLs
- [ ] Audit trail records who made changes

### Phase 3 - Rich Text (Future)
- [ ] Rich text editor loads and saves content
- [ ] Version history displays correctly
- [ ] PDF generation works properly
- [ ] Draft mode prevents accidental publishing
- [ ] Mobile WebView renders HTML correctly
- [ ] XSS protection prevents malicious code
- [ ] Approval workflow enforces review process

---

## Deployment Plan

### Phase 1 & 2 (Can deploy together)

1. **Backend** (30 min)
   - Add PATCH endpoint for organizations
   - Add URL validation
   - Deploy to production

2. **Web Admin** (1 hour)
   - Add settings form for principals
   - Test URL updates
   - Deploy to Vercel

3. **Mobile App** (2 hours)
   - Create TermsScreen component
   - Add navigation menu item
   - Test on iOS and Android
   - Submit app updates

4. **Testing** (1 hour)
   - End-to-end test: principal updates URL → parent views in app
   - Cross-browser/device testing
   - Performance check

**Total Time: ~5-6 hours for both Phase 1 & 2**

### Phase 3 (Future)
- Requires dedicated sprint (2-3 weeks)
- Beta testing with select schools
- Legal review and compliance check
- Gradual rollout with feature flag

---

## Recommendation

**Implement Now**:
✅ Phase 1 - Parent View in App  
✅ Phase 2 - Principal URL Management

**Defer to Later**:
⏸️ Phase 3 - Rich Text Editor (only if clear demand + budget)

This gives you 90% of the value with 10% of the complexity!
