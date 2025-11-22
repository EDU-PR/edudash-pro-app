# Database Sync Setup - EduSitePro ↔ EduDashPro

## 🔄 How Sync Works

### Current Architecture
```
EduSitePro (Marketing Website)
  └── registration_requests table
      ↓
      [MANUAL SYNC via Edge Function]
      ↓
EduDashPro (Management Platform)
  └── registration_requests table (local copy)
```

### Sync Direction
- **One-way**: EduSitePro → EduDashPro
- **Manual trigger**: No automatic sync (yet)
- **Operations**: INSERT new records + DELETE removed records

---

## 🚀 How to Sync Data

### Option 1: Using the UI (Recommended)
1. Go to **Registrations** page in EduDashPro
2. Click the **"Sync from EduSite"** button in the header
3. Wait for confirmation message
4. Data will refresh automatically

### Option 2: Using the Script
```bash
cd /home/king/Desktop/edudashpro
./sync-registrations-now.sh
```

### Option 3: Direct API Call
```bash
curl -X POST \
  'https://iggqchjjljmcilrqgpmx.supabase.co/functions/v1/sync-registrations-from-edusite' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## 📝 What Gets Synced

### ✅ Synced Operations
- **New registrations** from EduSitePro are added to EduDashPro
- **Deleted registrations** from EduSitePro are removed from EduDashPro
- All fields including:
  - Student information (name, DOB, gender)
  - Guardian information (name, email, phone, address)
  - Documents (birth certificate, clinic card, ID)
  - Payment information (amount, status, proof)
  - Status (pending, approved, rejected)

### ❌ Not Synced Automatically
- Status changes made in EduDashPro don't sync back to EduSitePro
- Manual updates to records in EduDashPro

---

## 🔧 Edge Function Details

### Function Name
`sync-registrations-from-edusite`

### Location
`/home/king/Desktop/edudashpro/supabase/functions/sync-registrations-from-edusite/index.ts`

### What It Does
1. Connects to both EduSitePro and EduDashPro databases
2. Fetches all registrations from EduSitePro
3. Compares with existing synced records in EduDashPro
4. **Inserts** new registrations (not yet in EduDashPro)
5. **Deletes** registrations that were removed from EduSitePro
6. Returns count of synced and deleted records

### Response Format
```json
{
  "success": true,
  "message": "Synced 5 registrations, deleted 2 removed records",
  "synced": 5,
  "deleted": 2
}
```

---

## 🐛 Troubleshooting

### "No new registrations to sync"
- This is normal if both databases are already in sync
- Try adding a test registration in EduSitePro

### Sync button not working
1. Check browser console for errors
2. Verify edge function is deployed: `supabase functions list`
3. Check edge function logs: Supabase Dashboard → Edge Functions → Logs

### Deleted data still showing
1. Click "Sync from EduSite" button to trigger deletion sync
2. The sync function now handles deletions automatically

### Missing environment variables
Required in Supabase Edge Function secrets:
- `EDUSITE_SUPABASE_URL`
- `EDUSITE_SERVICE_ROLE_KEY`

Check with: `supabase secrets list`

---

## 🔮 Future Enhancements

### Recommended Setup
1. **Add Cron Job**: Auto-sync every 5 minutes
   ```toml
   # In supabase/config.toml
   [[edge_runtime.cron]]
   function = "sync-registrations-from-edusite"
   schedule = "*/5 * * * *"
   ```

2. **Add Database Trigger**: Real-time sync on changes
   - Trigger on INSERT/DELETE in EduSitePro
   - Calls edge function automatically

3. **Bi-directional Sync**: Sync status changes back to EduSitePro
   - When approved in EduDashPro → update EduSitePro
   - Track which system is "source of truth" for each field

---

## 📊 Monitoring Sync Health

### Check Last Sync Status
```sql
-- In EduDashPro database
SELECT 
  COUNT(*) as total_synced,
  MAX(synced_at) as last_sync_time
FROM registration_requests
WHERE synced_from_edusite = true;
```

### Find Sync Conflicts
```sql
-- Records with same edusite_id
SELECT edusite_id, COUNT(*) 
FROM registration_requests 
WHERE edusite_id IS NOT NULL
GROUP BY edusite_id 
HAVING COUNT(*) > 1;
```

---

## ✅ Deployment Checklist

- [x] Edge function supports deletion sync
- [x] UI sync button added to registrations page
- [x] Edge function deployed to production
- [ ] Add cron job for automatic sync (recommended)
- [ ] Set up database triggers (optional)
- [ ] Add sync status monitoring dashboard (future)

---

## 🔑 Key Files

1. **Edge Function**: `/home/king/Desktop/edudashpro/supabase/functions/sync-registrations-from-edusite/index.ts`
2. **UI Component**: `/home/king/Desktop/edudashpro/web/src/app/dashboard/principal/registrations/page.tsx`
3. **Sync Script**: `/home/king/Desktop/edudashpro/sync-registrations-now.sh`
4. **This Guide**: `/home/king/Desktop/edudashpro/SYNC_SETUP_GUIDE.md`

---

## 📞 Support

If sync issues persist:
1. Check Supabase Edge Function logs
2. Verify both databases are accessible
3. Confirm environment variables are set correctly
4. Review the `synced_from_edusite` flag in records
