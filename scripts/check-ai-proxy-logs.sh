#!/bin/bash
# Check recent ai-proxy logs for quota check details
echo "📋 Recent ai-proxy logs (last 50 lines)"
echo "Looking for quota checks and 429 responses..."
echo ""

supabase functions logs ai-proxy --limit 50
