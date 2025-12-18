#!/bin/bash

# Set PayFast credentials in Supabase Edge Function secrets
# This script sets up PayFast integration for development/testing

set -e

echo "🔐 Setting PayFast credentials in Supabase Edge Function secrets..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found. Please install it first:"
  echo "   npm install -g supabase"
  echo ""
  echo "Alternatively, set these secrets via Supabase Dashboard:"
  echo "   https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/edge-functions"
  echo ""
  echo "Required secrets:"
  echo "   PAYFAST_MODE=sandbox"
  echo "   PAYFAST_MERCHANT_ID=30921435"
  echo "   PAYFAST_MERCHANT_KEY=REDACTED
  echo "   PAYFAST_TEST_EMAIL=test@edudashpro.org.za"
  echo ""
  exit 1
fi

# PayFast PRODUCTION credentials from dashboard (as of December 2025)
# These are PRODUCTION credentials - use sandbox mode only for testing
PAYFAST_MERCHANT_ID="30921435"
PAYFAST_MERCHANT_KEY=REDACTED
PAYFAST_MODE="production"  # Production mode for live payments (requires passphrase)
# Note: For sandbox testing, use PAYFAST_MODE=sandbox with sandbox credentials
PAYFAST_TEST_EMAIL="test@edudashpro.org.za"  # Fallback email for testing
WEB_BASE_URL="https://www.edudashpro.org.za"

echo "Setting PayFast secrets..."
echo ""

# Set mode (sandbox for testing, production for live)
echo "📝 Setting PAYFAST_MODE=${PAYFAST_MODE}..."
supabase secrets set PAYFAST_MODE="${PAYFAST_MODE}"

# Set merchant ID
echo "📝 Setting PAYFAST_MERCHANT_ID..."
supabase secrets set PAYFAST_MERCHANT_ID="${PAYFAST_MERCHANT_ID}"

# Set merchant key
echo "📝 Setting PAYFAST_MERCHANT_KEY..."
supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED

# Set test email for sandbox
echo "📝 Setting PAYFAST_TEST_EMAIL..."
supabase secrets set PAYFAST_TEST_EMAIL="${PAYFAST_TEST_EMAIL}"

# Set public URLs (important: PayFast cannot send Authorization header to Supabase Edge Functions)
echo "📝 Setting PAYFAST_NOTIFY_URL..."
supabase secrets set PAYFAST_NOTIFY_URL="${WEB_BASE_URL}/api/payfast/webhook"

echo "📝 Setting PAYFAST_RETURN_URL..."
supabase secrets set PAYFAST_RETURN_URL="${WEB_BASE_URL}/landing?flow=payment-return"

echo "📝 Setting PAYFAST_CANCEL_URL..."
supabase secrets set PAYFAST_CANCEL_URL="${WEB_BASE_URL}/landing?flow=payment-cancel"

echo ""
echo "⚠️  IMPORTANT: Production mode requires PAYFAST_PASSPHRASE"
echo "   Get your passphrase from: PayFast Dashboard → Settings → Integration"
echo "   Then run: supabase secrets set PAYFAST_PASSPHRASE=REDACTED
echo ""
read -p "Do you have the PayFast passphrase and want to set it now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  read -p "Enter PayFast Passphrase: " -s PAYFAST_PASSPHRASE
  echo ""
  supabase secrets set PAYFAST_PASSPHRASE=REDACTED
  echo "✅ PayFast passphrase set"
else
  echo "⚠️  Remember to set PAYFAST_PASSPHRASE before processing live payments!"
fi

echo ""
echo "✅ PayFast secrets set successfully!"
echo ""
echo "📋 Summary:"
echo "   Mode: ${PAYFAST_MODE} (PRODUCTION)"
echo "   Merchant ID: ${PAYFAST_MERCHANT_ID}"
echo "   Merchant Key: ${PAYFAST_MERCHANT_KEY:0:4}...${PAYFAST_MERCHANT_KEY: -4}"
echo "   Test Email: ${PAYFAST_TEST_EMAIL}"
echo ""
echo "⚠️  Important Notes:"
echo "   - PRODUCTION mode REQUIRES passphrase (set it now if you haven't)"
echo "   - Sandbox mode does NOT use passphrase"
echo "   - For testing, switch to sandbox: PAYFAST_MODE=sandbox"
echo "   - These are PRODUCTION credentials - will process REAL payments"
echo ""
echo "🔍 Verify secrets:"
echo "   supabase secrets list | grep PAYFAST"
echo ""

