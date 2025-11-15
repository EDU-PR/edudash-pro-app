#!/bin/bash

# Supabase Service Role Key Setup Helper
# Helps you safely add the SUPABASE_SERVICE_ROLE_KEY to .env.local

set -e

echo "🔑 Supabase Service Role Key Setup"
echo "===================================="
echo ""

ENV_FILE="/home/king/Desktop/edudashpro/web/.env.local"

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.local not found at $ENV_FILE"
    exit 1
fi

echo "📋 To get your Supabase Service Role Key:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/api"
echo "2. Scroll to 'Project API keys'"
echo "3. Copy the 'service_role' key (NOT the anon key!)"
echo ""
echo "⚠️  WARNING: This key is highly sensitive!"
echo "   - Do NOT share it publicly"
echo "   - Do NOT commit it to Git"
echo "   - Use it ONLY for server-side operations"
echo ""

# Check if key is already set
if grep -q 'SUPABASE_SERVICE_ROLE_KEY=REDACTED
    echo "✅ Service Role Key appears to already be set!"
    echo ""
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Keeping existing key"
        exit 0
    fi
fi

echo "Please paste your Supabase Service Role Key below:"
echo "(It should start with 'eyJ...')"
read -r SERVICE_ROLE_KEY

# Validate key format
if [[ ! $SERVICE_ROLE_KEY =~ ^eyJ ]]; then
    echo "❌ Error: Invalid key format. Service role keys should start with 'eyJ'"
    echo "   Make sure you copied the 'service_role' key, not the 'anon' key!"
    exit 1
fi

# Backup .env.local
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "📁 Backed up .env.local to .env.local.backup"

# Replace the placeholder
sed -i 's|SUPABASE_SERVICE_ROLE_KEY=REDACTED

echo "✅ Service Role Key added to .env.local"
echo ""

# Ask about Vercel
read -p "📦 Do you want to add this to Vercel as well? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "❌ Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    echo "🔐 Logging in to Vercel..."
    vercel login
    
    echo "🔗 Linking to Vercel project..."
    cd /home/king/Desktop/edudashpro/web
    vercel link
    
    echo "📤 Adding SUPABASE_SERVICE_ROLE_KEY to Vercel..."
    vercel env add SUPABASE_SERVICE_ROLE_KEY production <<EOF
$SERVICE_ROLE_KEY
EOF
    
    echo "✅ Service Role Key added to Vercel!"
fi

echo ""
echo "===================================="
echo "✅ Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Restart your development server"
echo "2. Test Google Sign-In at http://localhost:3000/sign-in"
echo "3. Check console for: '✅ Authentication successful!'"
echo ""
echo "📖 Full documentation: GOOGLE_SIGNIN_FIXES.md"
echo ""
