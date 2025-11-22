# Registration Management - Deployment Checklist

## ✅ Completed

- [x] Created `RegistrationNotifications` component with real-time updates
- [x] Added registration management page at `/admin/registrations`
- [x] Updated admin layout with registration link and notification bell
- [x] Created `sync-registration-to-edudash` Edge Function
- [x] Updated `send-email` Edge Function to support service role
- [x] Created SQL migration for EduSitePro sync columns
- [x] Created deployment script (`scripts/deploy-registration-sync.sh`)
- [x] Created setup documentation (`REGISTRATION_SYNC_SETUP.md`)

## 🔄 Ready to Deploy

Follow these steps in order:

### 1. Get EduSitePro Credentials

1. Open EduSitePro Supabase Dashboard: https://supabase.com/dashboard/project/bppuzibjlxgfwrujzfsz
2. Navigate to **Settings → API**
3. Copy these values:
   - `anon/public` key → for `NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY`
   - `service_role` key → for `EDUSITE_SUPABASE_SERVICE_ROLE_KEY`

### 2. Update Environment Variables

Add to `web/.env.local`:

```bash
# EduSitePro Database (for registration sync)
NEXT_PUBLIC_EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY=<paste_anon_key_here>
```

### 3. Deploy Edge Function

```bash
cd /home/king/Desktop/edudashpro
./scripts/deploy-registration-sync.sh
```

Then set secrets in Supabase Dashboard:
- Go to **Edge Functions → Secrets**
- Add:
  - `EDUSITE_SUPABASE_URL` = `https://bppuzibjlxgfwrujzfsz.supabase.co`
  - `EDUSITE_SUPABASE_SERVICE_ROLE_KEY` = `<paste_service_role_key>`

Or via CLI:
```bash
supabase secrets set EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co
supabase secrets set EDUSITE_SUPABASE_SERVICE_ROLE_KEY=REDACTED
```

### 4. Update EduSitePro Database

1. Open EduSitePro Supabase Dashboard
2. Go to **SQL Editor → New Query**
3. Copy content from `scripts/edusite-add-sync-columns.sql`
4. Run the query
5. Verify columns added:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'registration_requests' 
   AND column_name LIKE '%edudash%';
   ```

### 5. Verify SuperAdmin Role

In EduDashPro database:
```sql
UPDATE profiles 
SET role = 'superadmin' 
WHERE email = 'your_email@example.com';
```

### 6. Test the System

1. **Access Registration Management:**
   - Navigate to: `http://localhost:3000/admin/registrations`
   - Should see list of pending registrations from EduSitePro

2. **Test Notifications:**
   - Check bell icon shows pending count
   - Allow browser notifications when prompted
   - Should hear sound/see notification for new registrations

3. **Test Approval:**
   - Click "Approve" on a test registration
   - Verify:
     - ✅ Parent account created in EduDashPro
     - ✅ Student profile created
     - ✅ Welcome email sent
     - ✅ Registration marked as synced in EduSitePro
   - Check Edge Function logs:
     ```bash
     supabase functions logs sync-registration-to-edudash
     ```

4. **Test Rejection:**
   - Click "Reject" on a registration
   - Enter rejection reason
   - Verify status updated in EduSitePro

## 📊 Verification Queries

### Check EduSitePro Sync Status
```sql
-- In EduSitePro database
SELECT 
  id,
  student_first_name,
  student_last_name,
  status,
  synced_to_edudash,
  synced_at,
  edudash_student_id
FROM registration_requests
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 10;
```

### Check EduDashPro Student Creation
```sql
-- In EduDashPro database
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.enrollment_status,
  p.full_name as parent_name,
  p.email as parent_email
FROM students s
JOIN profiles p ON s.parent_id = p.id
ORDER BY s.created_at DESC
LIMIT 10;
```

### Check Email Logs
```sql
-- In EduDashPro database
SELECT 
  recipient,
  subject,
  status,
  created_at
FROM email_logs
WHERE subject LIKE '%Welcome%'
ORDER BY created_at DESC
LIMIT 10;
```

## 🐛 Troubleshooting

### Notifications not showing
- Clear browser cache
- Check browser console for errors
- Verify environment variables in `.env.local`
- Ensure logged in as superadmin

### Edge Function errors
```bash
# Check logs
supabase functions logs sync-registration-to-edudash --limit 50

# Common issues:
# - Missing EDUSITE_SUPABASE_SERVICE_ROLE_KEY secret
# - Invalid organization_id mapping
# - Email sending failures (check RESEND_API_KEY)
```

### Sync not happening
- Check registration status is "approved" in EduSitePro
- Verify Edge Function secrets are set
- Check network/CORS errors in browser console
- Ensure service role key has admin permissions

## 📝 Notes

- Real-time polling happens every 30 seconds
- Browser notifications require user permission
- Service role keys must remain secret (server-side only)
- Welcome emails sent via Resend (requires valid API key)
- Default class assignment requires at least one class to exist

## 🎯 Success Criteria

- [ ] Can view all registrations from EduSitePro
- [ ] Notification bell shows accurate pending count
- [ ] Browser notifications work (with permission)
- [ ] Can approve registration and parent account created
- [ ] Student profile created and linked to parent
- [ ] Welcome email received by parent
- [ ] Registration marked as synced in EduSitePro
- [ ] Can reject registration with reason
- [ ] Can filter/search registrations
- [ ] Export CSV functionality (future)

## 📚 Documentation

See `REGISTRATION_SYNC_SETUP.md` for complete setup guide and architecture details.
