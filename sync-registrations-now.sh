#!/bin/bash
# Manual script to sync registrations from EduSitePro to EduDashPro

echo "🔄 Syncing registrations from EduSitePro to EduDashPro..."

# Call the edge function
curl -X POST \
  'https://iggqchjjljmcilrqgpmx.supabase.co/functions/v1/sync-registrations-from-edusite' \
  -H "Authorization: Bearer YOUR_ANON_KEY_HERE" \
  -H "Content-Type: application/json"

echo ""
echo "✅ Sync complete!"
