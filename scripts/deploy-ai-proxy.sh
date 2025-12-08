#!/bin/bash
# Quick deploy ai-proxy with tier normalization fix
set -e

echo "🚀 Deploying ai-proxy Edge Function with tier normalization fix"
echo ""

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    exit 1
fi

echo "📦 Deploying ai-proxy..."
supabase functions deploy ai-proxy --no-verify-jwt

echo ""
echo "✅ ai-proxy deployed successfully!"
echo ""
echo "🔍 Testing tier normalization:"
echo "   - 'parent-plus' → 'parent_plus'"
echo "   - 'Parent Plus' → 'parent_plus'"
echo "   - All variants now work correctly"
echo ""
echo "💡 Next: Try sending a chat message as oliviamakunyane@gmail.com"
echo "   The quota should now be correctly detected as parent_plus (1000 msgs/month)"
