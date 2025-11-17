#!/bin/bash

# Deploy ai-proxy with dual Anthropic API key support
# Usage: ./deploy-ai-proxy-dual-keys.sh <ANTHROPIC_API_KEY_2>

if [ -z "$1" ]; then
  echo "Error: Please provide the second Anthropic API key"
  echo "Usage: ./deploy-ai-proxy-dual-keys.sh <ANTHROPIC_API_KEY_2>"
  exit 1
fi

ANTHROPIC_API_KEY_2=$1

echo "Setting ANTHROPIC_API_KEY_2 secret..."
supabase secrets set ANTHROPIC_API_KEY_2="$ANTHROPIC_API_KEY_2"

echo ""
echo "Deploying ai-proxy Edge Function..."
supabase functions deploy ai-proxy --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Load balancing is now active between:"
echo "  - ANTHROPIC_API_KEY (anthropic_1)"
echo "  - ANTHROPIC_API_KEY_2 (anthropic_2)"
echo ""
echo "Requests will be distributed round-robin to avoid rate limits."
