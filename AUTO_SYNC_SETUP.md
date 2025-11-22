# Automated Registration Sync Setup

## Current Status
✅ Sync function deployed and working
✅ Manual sync button in UI functional
⚠️ Automatic sync needs final configuration

## Option 1: Database Cron Job (Partially Set Up)

A cron job has been created in the database (job ID: 13) that attempts to run every 5 minutes. However, it needs the service role key to call the Edge Function.

### Complete Setup:
1. Go to Supabase Dashboard → Project Settings → API
2. Copy your **service_role** secret key
3. Run this SQL to set it up properly:

```sql
-- Store service role key securely
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- Verify the cron job is active
SELECT jobid, schedule, command, active 
FROM cron.job 
WHERE jobname = 'sync-registrations-every-5-min';
```

## Option 2: External Cron Service (Recommended for Production)

Use a service like **Render Cron Jobs**, **GitHub Actions**, or **Vercel Cron**:

### Using GitHub Actions:
Create `.github/workflows/sync-registrations.yml`:

```yaml
name: Sync Registrations
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call Sync Function
        run: |
          curl -X POST \
            'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite' \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

Then add your `SUPABASE_SERVICE_ROLE_KEY` to GitHub Secrets.

### Using Vercel Cron (If using Vercel):
Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/sync-registrations",
    "schedule": "*/5 * * * *"
  }]
}
```

Create `/api/sync-registrations/route.ts`:

```typescript
export async function GET() {
  const response = await fetch(
    'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )
  return Response.json(await response.json())
}
```

## Option 3: Simple Linux Cron (If you have a server)

On any Linux server with cron:

```bash
# Edit crontab
crontab -e

# Add this line (replace YOUR_SERVICE_KEY):
*/5 * * * * curl -X POST 'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/sync-registrations-from-edusite' -H 'Authorization: Bearer YOUR_SERVICE_KEY' -H 'Content-Type: application/json'
```

## Testing

After setting up any option, verify it works:

1. Delete a record from EduSitePro
2. Wait 5 minutes
3. Check EduDashPro - the record should be automatically removed

## Monitoring

Check sync history:
```sql
-- View cron job run history (if using pg_cron)
SELECT * FROM cron.job_run_details 
WHERE jobid = 13 
ORDER BY start_time DESC 
LIMIT 10;
```

Or check Edge Function logs in Supabase Dashboard → Edge Functions → sync-registrations-from-edusite → Logs

## Current Sync Schedule Recommendations

- **Development**: Every 5 minutes (current setting)
- **Production**: Every 2-5 minutes for real-time feel
- **Low traffic**: Every 15-30 minutes to reduce costs

To change frequency, update the cron expression:
- `*/5 * * * *` = Every 5 minutes
- `*/15 * * * *` = Every 15 minutes  
- `0 * * * *` = Every hour
- `0 */6 * * *` = Every 6 hours
