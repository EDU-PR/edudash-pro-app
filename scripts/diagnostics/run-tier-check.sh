#!/bin/bash
# Run tier diagnostics for a specific user email
# Usage: ./run-tier-check.sh user@example.com

set -e

USER_EMAIL="${1:-oliviamakunyane@gmail.com}"

echo "🔍 Checking tier status for: $USER_EMAIL"
echo ""

# Check if we have database access via psql
if command -v psql &> /dev/null && [ -n "$SUPABASE_DB_PASSWORD" ]; then
    echo "Using psql direct connection..."
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        -h aws-0-ap-southeast-1.pooler.supabase.com \
        -p 6543 \
        -U postgres.lvvvjywrmpcqrpvuptdi \
        -d postgres \
        -v user_email="'$USER_EMAIL'" \
        -f "$(dirname "$0")/check-tier-status.sql"
else
    echo "⚠️  psql not available or SUPABASE_DB_PASSWORD not set"
    echo ""
    echo "Alternative: Run this SQL in Supabase SQL Editor:"
    echo "  1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/editor"
    echo "  2. Open: scripts/diagnostics/check-tier-status.sql"
    echo "  3. Replace EMAIL_HERE with: $USER_EMAIL"
    echo "  4. Click Run"
    echo ""
    echo "Or set SUPABASE_DB_PASSWORD environment variable and retry."
    exit 1
fi
