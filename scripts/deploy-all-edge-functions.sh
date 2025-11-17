#!/bin/bash

# Deploy All Edge Functions Script
# Deploys all Supabase Edge Functions to production
# WARP.md Compliance: Production deployment workflow

set -e

echo "🚀 EduDash Pro - Deploy All Edge Functions"
echo "=========================================="
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're linked to a project
if [ ! -f ".git/config" ] || [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory"
    exit 1
fi

# Confirm deployment
echo "⚠️  This will deploy ALL edge functions to production."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "📋 Edge Functions to Deploy:"
echo "----------------------------"

# Core AI Functions
CORE_AI_FUNCTIONS=(
    "ai-proxy"
    "ai-gateway"
    "ai-usage"
)

# AI Feature Functions
AI_FEATURE_FUNCTIONS=(
    "generate-exam"
    "grade-exam"
    "explain-answer"
    "rag-answer"
    "rag-search"
    "web-search"
    "ingest-file"
)

# Voice & Transcription Functions
VOICE_FUNCTIONS=(
    "azure-speech-token"
    "transcribe-audio"
    "stt-proxy"
    "tts-proxy"
    "openai-realtime-token"
)

# Payment Functions
PAYMENT_FUNCTIONS=(
    "payfast-create-payment"
    "payfast-webhook"
    "payments-bridge"
    "payments-create-checkout"
    "payments-webhook"
    "webhooks-payfast"
    "revenuecat-webhook"
)

# Communication Functions
COMMUNICATION_FUNCTIONS=(
    "send-email"
    "send-push"
    "notifications-dispatcher"
    "whatsapp-send"
    "whatsapp-webhook"
    "sms-webhook"
)

# Integration Functions
INTEGRATION_FUNCTIONS=(
    "google-calendar-sync"
    "dash-context-sync"
    "dash-reminders-create"
)

# Utility Functions
UTILITY_FUNCTIONS=(
    "delete-account"
    "get-secrets"
    "compute-progress-metrics"
    "cost-aggregator"
    "service-health-monitor"
    "principal-hub-api"
)

# Combine all functions
ALL_FUNCTIONS=(
    "${CORE_AI_FUNCTIONS[@]}"
    "${AI_FEATURE_FUNCTIONS[@]}"
    "${VOICE_FUNCTIONS[@]}"
    "${PAYMENT_FUNCTIONS[@]}"
    "${COMMUNICATION_FUNCTIONS[@]}"
    "${INTEGRATION_FUNCTIONS[@]}"
    "${UTILITY_FUNCTIONS[@]}"
)

echo ""
echo "Total functions: ${#ALL_FUNCTIONS[@]}"
echo ""

# Count for progress tracking
TOTAL=${#ALL_FUNCTIONS[@]}
CURRENT=0
SUCCEEDED=0
FAILED=0
FAILED_FUNCTIONS=()

# Deploy each function
for func in "${ALL_FUNCTIONS[@]}"; do
    CURRENT=$((CURRENT + 1))
    echo ""
    echo "[$CURRENT/$TOTAL] Deploying: $func"
    echo "----------------------------------------"
    
    # Check if function directory exists
    if [ ! -d "supabase/functions/$func" ]; then
        echo "⚠️  Skipping $func (directory not found)"
        continue
    fi
    
    # Deploy function
    if supabase functions deploy "$func" --no-verify-jwt 2>&1; then
        echo "✅ $func deployed successfully"
        SUCCEEDED=$((SUCCEEDED + 1))
    else
        echo "❌ $func deployment failed"
        FAILED=$((FAILED + 1))
        FAILED_FUNCTIONS+=("$func")
    fi
    
    # Brief pause to avoid rate limiting
    sleep 1
done

echo ""
echo "=========================================="
echo "📊 Deployment Summary"
echo "=========================================="
echo "Total functions: $TOTAL"
echo "✅ Successful: $SUCCEEDED"
echo "❌ Failed: $FAILED"
echo ""

if [ ${#FAILED_FUNCTIONS[@]} -gt 0 ]; then
    echo "Failed functions:"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "  - $func"
    done
    echo ""
fi

echo "🔧 Next Steps:"
echo "----------------------------------------"
echo "1. Verify environment variables in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions"
echo ""
echo "2. Required environment variables:"
echo "   - ANTHROPIC_API_KEY"
echo "   - OPENAI_API_KEY"
echo "   - ZAI_API_KEY"
echo "   - AZURE_SPEECH_KEY"
echo "   - AZURE_SPEECH_REGION"
echo "   - PAYFAST_MERCHANT_ID"
echo "   - PAYFAST_MERCHANT_KEY"
echo "   - PAYFAST_PASSPHRASE"
echo "   - SENDGRID_API_KEY"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_AUTH_TOKEN"
echo ""
echo "3. Test critical functions:"
echo "   - ai-proxy (exam generation, chat)"
echo "   - send-push (notifications)"
echo "   - payfast-webhook (payments)"
echo ""
echo "4. Monitor function logs:"
echo "   supabase functions logs ai-proxy --tail"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Some functions failed to deploy. Review errors above."
    exit 1
else
    echo "🎉 All edge functions deployed successfully!"
    exit 0
fi
