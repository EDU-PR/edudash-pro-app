# Organization Approval Workflow - Quick Reference

## 🚀 Quick Start

```bash
# 1. Run setup script
cd /home/king/Desktop/edudashpro
./setup-approval-workflow.sh

# 2. Start servers (if not auto-started)
# Terminal 1:
cd web && npm run dev

# Terminal 2:
cd ../edusitepro && npm run dev
```

## 📋 Checklist

### Initial Setup (One-Time)
- [ ] Apply migration: `supabase/migrations/20251201000002_organization_registration_requests.sql`
- [ ] Install bcryptjs in EduSitePro: `npm install bcryptjs`
- [ ] Configure EduDashPro `.env`: Add `NEXT_PUBLIC_EDUSITEPRO_API_URL`
- [ ] Configure EduSitePro `.env`: Add `EDUDASH_SUPABASE_URL`, `EDUDASH_SERVICE_ROLE_KEY`, `INTERNAL_API_KEY`

### Testing Workflow
- [ ] Submit registration at: http://localhost:3000/sign-up/principal
- [ ] Verify pending approval page appears
- [ ] Check request in EduSitePro DB: `organization_registration_requests` table
- [ ] Approve at: http://localhost:3002/admin/organization-requests
- [ ] Verify organizations created in both databases
- [ ] Test sign-in with approved credentials

## 🔑 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `/web/src/app/sign-up/principal/page.tsx` | Registration form | ✅ Updated |
| `/web/src/app/sign-up/pending-approval/page.tsx` | Pending page | ✅ Created |
| `/edusitepro/src/app/api/organizations/register/route.ts` | Submit API | ✅ Created |
| `/edusitepro/src/app/api/organizations/approve/[requestId]/route.ts` | Approve API | ✅ Created |
| `/edusitepro/src/app/admin/organization-requests/page.tsx` | Admin UI | ✅ Created |
| `/edusitepro/supabase/migrations/20251201000002_*.sql` | DB Migration | ⚠️ Apply |

## 🌐 URLs

### Development
- **Registration Form:** http://localhost:3000/sign-up/principal
- **Pending Approval:** http://localhost:3000/sign-up/pending-approval
- **SuperAdmin Approval:** http://localhost:3002/admin/organization-requests
- **Sign In:** http://localhost:3000/sign-in

### Production
- **Registration Form:** https://edudashpro.org.za/sign-up/principal
- **SuperAdmin Approval:** https://edusitepro.edudashpro.org.za/admin/organization-requests

## 🔐 Environment Variables

### EduDashPro (.env)
```bash
NEXT_PUBLIC_EDUSITEPRO_API_URL=http://localhost:3002
# Production: https://edusitepro.edudashpro.org.za
```

### EduSitePro (.env)
```bash
# EduSitePro Database (DB2)
NEXT_PUBLIC_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=REDACTED

# EduDashPro Database (DB1)
EDUDASH_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
EDUDASH_SERVICE_ROLE_KEY=<your_edudash_service_key>

# Security
INTERNAL_API_KEY=<generate_with_openssl_rand_hex_32>
```

## 📊 Workflow States

```
User Submission → Pending → SuperAdmin Review → Approved → Active
                                               ↘ Rejected → Closed
```

## 🔧 Common Commands

### Apply Migration
```bash
cd /home/king/Desktop/edusitepro
npx supabase migration up
```

### Generate API Key
```bash
openssl rand -hex 32
```

### Check Database
```sql
-- Check pending requests
SELECT * FROM organization_registration_requests WHERE status = 'pending';

-- Check approved organizations (both DBs should have same UUID)
-- EduSitePro DB:
SELECT id, name FROM organizations;

-- EduDashPro DB:
SELECT id, name FROM organizations;
```

### Start Dev Servers
```bash
# EduDashPro (port 3000)
cd /home/king/Desktop/edudashpro/web
npm run dev

# EduSitePro (port 3002)
cd /home/king/Desktop/edusitepro
npm run dev
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Add CORS headers to API routes |
| Service key errors | Use `service_role` key, not `anon` key |
| Migration fails | Drop table and retry: `DROP TABLE organization_registration_requests CASCADE;` |
| Can't approve | Check EDUDASH_SERVICE_ROLE_KEY is set correctly |
| Wrong redirect | Clear browser cache and cookies |

## 📞 Support

- **Guide:** `/ORGANIZATION_APPROVAL_WORKFLOW_GUIDE.md`
- **Email:** support@edudashpro.org.za
- **Supabase Dashboard (EduSitePro):** https://supabase.com/dashboard/project/bppuzibjlxgfwrujzfsz
- **Supabase Dashboard (EduDashPro):** https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi

## 🎯 API Endpoints

### POST /api/organizations/register
**Purpose:** Submit registration request  
**Auth:** Public (no auth required)  
**Body:** All form fields (20+ fields)  
**Response:** `{ requestId, status: "pending" }`

### POST /api/organizations/approve/[requestId]
**Purpose:** Approve request  
**Auth:** SuperAdmin (to be implemented)  
**Response:** `{ edusiteproOrgId, edudashproOrgId }`

### DELETE /api/organizations/approve/[requestId]
**Purpose:** Reject request  
**Auth:** SuperAdmin (to be implemented)  
**Body:** `{ reason: "..." }`  
**Response:** `{ success: true }`

## ⚠️ Production Requirements

Before deploying to production:

1. **Security:**
   - [ ] Add SuperAdmin authentication to approval UI
   - [ ] Implement rate limiting on registration endpoint
   - [ ] Add CAPTCHA to registration form
   - [ ] Rotate INTERNAL_API_KEY regularly

2. **Notifications:**
   - [ ] Send confirmation email on submission
   - [ ] Send approval/rejection notification
   - [ ] Set up SMS notifications (optional)

3. **Monitoring:**
   - [ ] Set up error tracking (Sentry)
   - [ ] Monitor approval times
   - [ ] Track rejection reasons
   - [ ] Alert on approval failures

4. **Testing:**
   - [ ] End-to-end tests
   - [ ] Load testing
   - [ ] Security audit
   - [ ] Penetration testing

## 📈 Metrics to Track

- **Registration Submissions:** Count per day/week
- **Approval Time:** Median and P95
- **Rejection Rate:** % of requests rejected
- **Approval Success:** % of approvals that succeed
- **Cross-DB Sync Failures:** Count and causes
- **User Complaints:** About approval delays

---

**Last Updated:** 2024-12-01  
**Version:** 1.0.0  
**Status:** Ready for Testing
