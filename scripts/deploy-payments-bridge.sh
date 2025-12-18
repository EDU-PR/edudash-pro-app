#!/bin/bash
# Deploy payments-bridge Edge Function with unauthenticated access

set -e

echo "🚀 Deploying payments-bridge Edge Function..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with:"
    echo "   npm install -g supabase"
    echo "   or use: npx supabase"
    exit 1
fi

# Use npx if supabase command not found
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
else
    SUPABASE_CMD="npx supabase"
fi

echo "📦 Deploying payments-bridge function..."
echo "   This will apply the supabase.toml configuration (verify_jwt = false)"
echo ""

# Deploy with --no-verify-jwt flag (redundant but ensures it's set)
$SUPABASE_CMD functions deploy payments-bridge --no-verify-jwt

echo ""
echo "✅ payments-bridge deployed successfully!"
echo ""
echo "🔍 The function should now be accessible without authentication:"
echo "   https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/payments-bridge/return"
echo ""
echo "💡 Note: The supabase.toml file in supabase/functions/payments-bridge/"
echo "   sets verify_jwt = false, which allows unauthenticated access."
echo ""

