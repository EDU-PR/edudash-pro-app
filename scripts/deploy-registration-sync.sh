#!/bin/bash

# Deploy Registration Sync Edge Function
# This script deploys the sync-registration-to-edudash Edge Function and sets up required secrets

set -e

echo "🚀 Deploying Registration Sync Edge Function..."

# Check if we're in the correct directory
if [ ! -d "supabase/functions/sync-registration-to-edudash" ]; then
  echo "❌ Error: Must be run from the edudashpro root directory"
  exit 1
fi

# Deploy the Edge Function
echo "📦 Deploying function..."
supabase functions deploy sync-registration-to-edudash --no-verify-jwt

echo ""
echo "✅ Edge Function deployed successfully!"
echo ""
echo "⚙️  Next steps:"
echo ""
echo "1. Set the following secrets in Supabase Dashboard:"
echo "   → Settings → Edge Functions → Secrets"
echo ""
echo "   EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co"
echo "   EDUSITE_SUPABASE_SERVICE_ROLE_KEY=REDACTED
echo ""
echo "2. Or set them via CLI (if you have them):"
echo ""
echo "   supabase secrets set EDUSITE_SUPABASE_URL=https://bppuzibjlxgfwrujzfsz.supabase.co"
echo "   supabase secrets set EDUSITE_SUPABASE_SERVICE_ROLE_KEY=REDACTED
echo ""
echo "3. Run the EduSitePro migration:"
echo "   → Open EduSitePro Supabase project"
echo "   → SQL Editor → New Query"
echo "   → Run scripts/edusite-add-sync-columns.sql"
echo ""
echo "4. Update web/.env.local with EduSitePro credentials"
echo ""
echo "📚 See REGISTRATION_SYNC_SETUP.md for complete setup guide"
