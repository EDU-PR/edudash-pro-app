#!/bin/bash
# Set PayFast Production Secrets for Supabase Edge Functions
#
# USAGE:
#   ./set-payfast-production.sh
#
# You will be prompted for:
#   - PAYFAST_MERCHANT_ID: Your live merchant ID from PayFast
#   - PAYFAST_MERCHANT_KEY: Your live merchant key from PayFast
#   - PAYFAST_PASSPHRASE: Your passphrase (REQUIRED for production!)
#
# IMPORTANT: These are LIVE credentials - payments will be real!

set -e

echo "==================================================="
echo "  PayFast Production Configuration"
echo "  ⚠️  WARNING: This enables REAL payments!"
echo "==================================================="
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: Neither supabase CLI nor npx found"
    exit 1
fi

# Supabase project reference
SUPABASE_PROJECT_REF="lvvvjywrmpcqrpvuptdi"

# Prompt for credentials
echo "Enter your PayFast LIVE credentials from: https://www.payfast.co.za/acc/integration"
echo ""

read -p "PAYFAST_MERCHANT_ID: " MERCHANT_ID
if [ -z "$MERCHANT_ID" ]; then
    echo "❌ Merchant ID is required"
    exit 1
fi

read -p "PAYFAST_MERCHANT_KEY: " MERCHANT_KEY
if [ -z "$MERCHANT_KEY" ]; then
    echo "❌ Merchant Key is required"
    exit 1
fi

read -s -p "PAYFAST_PASSPHRASE (required for production): " PASSPHRASE
echo ""
if [ -z "$PASSPHRASE" ]; then
    echo "❌ Passphrase is required for production mode"
    exit 1
fi

echo ""
echo "Setting secrets..."

# Use npx if supabase CLI not installed directly
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
else
    SUPABASE_CMD="npx supabase"
fi

# Set production mode
$SUPABASE_CMD secrets set --project-ref "$SUPABASE_PROJECT_REF" PAYFAST_MODE="production"
echo "✅ Set PAYFAST_MODE=production"

# Set credentials
$SUPABASE_CMD secrets set --project-ref "$SUPABASE_PROJECT_REF" PAYFAST_MERCHANT_ID="$MERCHANT_ID"
echo "✅ Set PAYFAST_MERCHANT_ID"

$SUPABASE_CMD secrets set --project-ref "$SUPABASE_PROJECT_REF" PAYFAST_MERCHANT_KEY="$MERCHANT_KEY"
echo "✅ Set PAYFAST_MERCHANT_KEY"

$SUPABASE_CMD secrets set --project-ref "$SUPABASE_PROJECT_REF" PAYFAST_PASSPHRASE="$PASSPHRASE"
echo "✅ Set PAYFAST_PASSPHRASE"

echo ""
echo "==================================================="
echo "  ✅ PayFast Production Configuration Complete"
echo "==================================================="
echo ""
echo "Next steps:"
echo "1. Deploy the Edge Functions:"
echo "   supabase functions deploy payments-create-checkout --project-ref $SUPABASE_PROJECT_REF"
echo "   supabase functions deploy payfast-webhook --project-ref $SUPABASE_PROJECT_REF"
echo ""
echo "2. Configure webhook URL in PayFast Dashboard:"
echo "   https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/payfast-webhook"
echo ""
echo "3. Test a small payment to verify everything works"
echo ""
