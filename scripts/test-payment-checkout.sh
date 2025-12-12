#!/bin/bash

# Test script for payments-create-checkout Edge Function
# Usage: ./scripts/test-payment-checkout.sh

set -e

echo "🧪 Testing PayFast Checkout Edge Function"
echo "=========================================="
echo ""

# Check if .env exists and source it
if [ -f .env ]; then
  echo "📋 Loading environment variables from .env..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Get Supabase URL and keys
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://lvvvjywrmpcqrpvuptdi.supabase.co}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$ANON_KEY" ]; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env"
  echo "Please set it in your .env file"
  exit 1
fi

echo "🔗 Supabase URL: $SUPABASE_URL"
echo ""

# Test parameters (adjust these for your test)
USER_ID="${1:-test-user-id}"
PLAN_TIER="${2:-parent_starter}"
BILLING="${3:-monthly}"
SCOPE="${4:-user}"
EMAIL="${5:-test@example.com}"

echo "📝 Test Parameters:"
echo "   User ID: $USER_ID"
echo "   Plan Tier: $PLAN_TIER"
echo "   Billing: $BILLING"
echo "   Scope: $SCOPE"
echo "   Email: $EMAIL"
echo ""

# Create JSON payload
PAYLOAD=$(cat <<EOF
{
  "scope": "$SCOPE",
  "userId": "$USER_ID",
  "planTier": "$PLAN_TIER",
  "billing": "$BILLING",
  "email_address": "$EMAIL"
}
EOF
)

echo "🚀 Sending request to Edge Function..."
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/payments-create-checkout" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Split response and status code
HTTP_BODY=$(echo "$RESPONSE" | sed '$d')
HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)

echo "📊 Response Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Success! Response:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  
  # Extract redirect URL if present
  REDIRECT_URL=$(echo "$HTTP_BODY" | jq -r '.redirect_url // empty' 2>/dev/null)
  if [ -n "$REDIRECT_URL" ] && [ "$REDIRECT_URL" != "null" ]; then
    echo ""
    echo "🔗 PayFast Redirect URL:"
    echo "$REDIRECT_URL"
    echo ""
    echo "💡 Tip: Open this URL in your browser to complete the payment"
  fi
else
  echo "❌ Error! Response:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  
  # Common error messages
  if echo "$HTTP_BODY" | grep -q "Invalid merchant ID"; then
    echo ""
    echo "🔧 Fix: Check PAYFAST_MERCHANT_ID secret in Supabase Dashboard"
  fi
  
  if echo "$HTTP_BODY" | grep -q "email address"; then
    echo ""
    echo "🔧 Fix: Ensure email_address is a valid email format"
  fi
  
  if echo "$HTTP_BODY" | grep -q "Authentication required"; then
    echo ""
    echo "🔧 Fix: Check your ANON_KEY is correct"
  fi
fi

echo ""
echo "📋 Next steps:"
echo "   1. Check Supabase Dashboard logs for detailed function execution"
echo "   2. Verify PayFast secrets are set correctly"
echo "   3. Test with real user ID and email from your database"
echo ""

