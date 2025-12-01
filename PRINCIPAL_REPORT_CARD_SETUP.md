# Principal Report Card Setup Guide

## 📍 Where to Configure Report Cards

**Path**: `/dashboard/principal/settings/report-card`

**How to Access**:
1. Login as Principal
2. Click **"Settings"** in the left sidebar
3. Click the **"Report Card Configuration"** card (purple icon)
4. Or navigate directly to: `https://your-domain.com/dashboard/principal/settings/report-card`

---

## 🎨 What You Can Configure

### School Branding
- **School Logo**: Upload URL for school logo (displays at top of reports)
- **School Name**: Official school name
- **Principal Name**: Your name (appears on reports)

### Contact Information
- **School Address**: Physical address for report headers
- **Phone Number**: Contact phone
- **Email Address**: Contact email
- **Website**: School website URL (optional)

### Report Customization
- **Report Header Text**: Custom title (default: "Student Progress Report")
- **Report Footer Text**: Confidentiality notice or custom message
- **Principal Signature**: Upload signature image URL

### Display Options (Checkboxes)
- ☑️ Show School Logo
- ☑️ Show Address
- ☑️ Show Contact Info
- ☑️ Show Principal Signature

---

## 📄 How Branding Appears on Reports

### Report Header (Top Section)
```
┌─────────────────────────────────────┐
│        [School Logo Image]          │
│    Your Custom Report Header        │
│       Young Eagles Preschool        │
│   123 Education St, City, 0000     │
│  Tel: +27 12 345 6789 | Email...   │
└─────────────────────────────────────┘
```

### Report Footer (Bottom Section)
```
┌─────────────────────────────────────┐
│  PREPARED BY         APPROVED BY    │
│  Teacher Name        [Signature]    │
│  Date: Dec 1, 2025   Principal Name│
│                      Principal      │
├─────────────────────────────────────┤
│  Your custom footer text here...   │
│  (Confidentiality notice, etc.)    │
└─────────────────────────────────────┘
```

---

## ✅ Testing Your Configuration

1. **Save Settings** → Click "Save Settings" button
2. **Create Test Report** → Go to `Teachers → Reports → Create Report`
3. **Preview** → Click "Preview" button to see how branding appears
4. **Download PDF** → Click "Download PDF" to test print version

---

## 🐛 Fixed Issues (Dec 1, 2025)

### ✅ Teacher Invite Error Fixed
**Error**: `Could not find the 'phone_number' column of 'teachers'`

**Solution**: Changed `phone_number` to `phone` throughout teacher invite form to match database schema.

**Files Updated**:
- `/web/src/app/dashboard/principal/teachers/invite/page.tsx`
  - State: `phone_number` → `phone`
  - Database insert: `phone_number` → `phone`
  - Input field: `id="phone_number"` → `id="phone"`

**Status**: ✅ Fixed - You can now invite teachers successfully!

---

## 📝 Usage Notes

- **Logo Images**: Use publicly accessible URLs (e.g., uploaded to Supabase Storage)
- **Signature Images**: Same as logo - must be publicly accessible URL
- **Image Formats**: PNG, JPG, or SVG recommended
- **Max Logo Height**: 80px (auto-scaled)
- **Max Signature Height**: 50px (auto-scaled)
- **Preview Before Saving**: Always preview to ensure branding looks correct

---

## 🔗 Related Pages

- **Settings Home**: `/dashboard/principal/settings`
- **Teachers List**: `/dashboard/principal/teachers`
- **Create Report**: `/dashboard/principal/reports/create`
- **View Reports**: `/dashboard/principal/reports`

---

## 💡 Quick Tips

1. **Upload Images First**: Upload logo and signature to Supabase Storage, then copy the public URLs
2. **Test with Real Data**: Create a test report to see exactly how branding renders
3. **Mobile Friendly**: All branding auto-scales for mobile/tablet viewing
4. **Dark Mode**: Report previews use light background regardless of user's theme preference
5. **Print Ready**: PDF exports include all branding automatically

---

## 🆘 Support

If you encounter issues:
1. Check that image URLs are publicly accessible
2. Verify all required fields are filled
3. Clear browser cache (Ctrl+Shift+R)
4. Contact support: support@edudashpro.org.za
