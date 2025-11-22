# Activate Real-Time Sync - Deployment Guide

## Overview
This guide activates real-time database triggers that immediately sync changes from EduSitePro to EduDashPro instead of waiting for the 5-minute cron job.

## Prerequisites
- [ ] Supabase CLI installed and logged in
- [ ] Access to EduSitePro database (bppuzibjlxgfwrujzfsz)
- [ ] Edge function `sync-registrations-from-edusite` deployed on EduDashPro
- [ ] Service role key for EduDashPro configured

## Architecture

```
┌─────────────────┐
│   EduSitePro    │
│   (Marketing)   │
└────────┬────────┘
         │
         │ 1. User uploads POP
         │ 2. Admin approves registration
         │ 3. Database trigger fires
         │
         ▼
  ┌──────────────┐
  │   Triggers   │ ◄── INSERT / UPDATE / DELETE
  └──────┬───────┘
         │
         │ HTTP POST (instant)
         │
         ▼
┌─────────────────────────────────┐
│  EduDashPro Edge Function       │
│  sync-registrations-from-edusite│
└────────┬────────────────────────┘
         │
         │ Sync data
         │
         ▼
┌─────────────────┐
│  EduDashPro     │
│  (Management)   │
└─────────────────┘
```

**Fallback:** pg_cron still runs every 5 minutes as safety net.

## Step 1: Verify Edge Function Exists

```bash
cd /home/king/Desktop/edudashpro
supabase functions list
```

**Expected output:**
```
sync-registrations-from-edusite
sync-approval-to-edusite
sync-registration-to-edudash
```

## Step 2: Deploy Triggers to EduSitePro Database

```bash
# Connect to EduSitePro database
psql "postgresql://postgres.bppuzibjlxgfwrujzfsz:7nRkyAzTdgkLSw04@aws-0-af-south-1.pooler.supabase.com:6543/postgres"

# Run the activation script
\i /home/king/Desktop/edudashpro/activate-realtime-sync.sql

# Verify triggers are active
SELECT 
  trigger_name, 
  event_manipulation as event,
  action_statement as function
FROM information_schema.triggers
WHERE event_object_table = 'registration_requests'
ORDER BY trigger_name;
```

**Expected output:**
```
trigger_sync_new_registration      | INSERT | EXECUTE FUNCTION sync_new_registration_to_edudash()
trigger_sync_registration_updates  | UPDATE | EXECUTE FUNCTION sync_registration_updates_to_edudash()
trigger_sync_registration_deletion | DELETE | EXECUTE FUNCTION sync_registration_deletion_to_edudash()
```

## Step 3: Test Real-Time Sync

### Test 1: New Registration (INSERT)
1. Go to EduSitePro registration form
2. Submit a new registration
3. **Expected:** Registration appears in EduDashPro dashboard **immediately** (not after 5 min)

### Test 2: POP Upload (UPDATE)
1. Upload proof of payment to existing registration
2. **Expected:** POP appears in EduDashPro **immediately**
3. Approve button should become enabled **immediately**

### Test 3: Status Change (UPDATE)
1. In EduSitePro admin, approve a registration
2. **Expected:** Status changes to "approved" in EduDashPro **immediately**

### Test 4: Deletion (DELETE)
1. Delete a registration from EduSitePro
2. **Expected:** Registration removed from EduDashPro **immediately**

## Step 4: Monitor Trigger Execution

```sql
-- Check trigger logs in EduSitePro
SELECT * FROM pg_stat_user_functions 
WHERE funcname LIKE 'sync_%' 
ORDER BY calls DESC;

-- Check edge function logs in EduDashPro
-- Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/logs/edge-functions
```

## Step 5: Verify No Duplicate Syncs

The trigger calls the same edge function as pg_cron. The edge function is **idempotent** (safe to call multiple times):
- Uses `edusite_id` to track synced records
- INSERT only if `edusite_id` not found
- UPDATE only if fields changed
- DELETE only if exists

**No duplicates will be created** even if trigger and cron both run.

## Troubleshooting

### Issue: Triggers not firing
**Check:** Ensure `http` extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'http';
```

If not found:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### Issue: CORS errors in logs
**Cause:** Edge function URL incorrect
**Fix:** Verify URL in trigger function points to EduDashPro:
```
https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite
```

### Issue: 401 Unauthorized
**Cause:** Service role key expired or incorrect
**Fix:** Update service role key in trigger function (line 24)

### Issue: Sync still takes 5 minutes
**Cause:** Triggers not deployed or disabled
**Fix:** Run verification query:
```sql
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'registration_requests';
```

If empty, re-run `activate-realtime-sync.sql`

## Rollback Plan

If triggers cause issues, disable them:

```sql
-- Disable all triggers (keep functions)
DROP TRIGGER IF EXISTS trigger_sync_new_registration ON registration_requests;
DROP TRIGGER IF EXISTS trigger_sync_registration_updates ON registration_requests;
DROP TRIGGER IF EXISTS trigger_sync_registration_deletion ON registration_requests;
```

pg_cron will continue syncing every 5 minutes as fallback.

## Performance Considerations

- **Trigger overhead:** ~50ms per operation (minimal)
- **Network latency:** ~200-500ms for edge function call
- **Total delay:** < 1 second vs 5 minutes with cron only
- **Database load:** Triggers use async HTTP POST (non-blocking)

## Success Criteria

✅ Triggers deployed and active in EduSitePro database  
✅ New registrations appear in EduDashPro instantly  
✅ POP uploads enable approve button instantly  
✅ Status changes sync instantly  
✅ No duplicate records created  
✅ pg_cron still runs as safety net  
✅ No performance degradation  

## Next Steps

Once real-time sync is verified:
1. Monitor for 24 hours
2. Check for any failed trigger executions
3. Consider adding retry logic if needed
4. Document trigger behavior in `WARP.md`
