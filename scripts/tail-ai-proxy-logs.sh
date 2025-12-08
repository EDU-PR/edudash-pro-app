#!/bin/bash
# Tail ai-proxy logs to see quota check details
echo "📋 Tailing ai-proxy logs (press Ctrl+C to stop)"
echo "Looking for quota check and tier detection..."
echo ""

supabase functions logs ai-proxy --tail
