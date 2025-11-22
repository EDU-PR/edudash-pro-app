#!/bin/bash

# ================================================================
# Deploy Real-Time Sync Triggers to EduSitePro Database
# ================================================================
# This script activates database triggers that immediately sync
# changes from EduSitePro to EduDashPro (< 1 second delay)
# ================================================================

set -e  # Exit on error

echo "🚀 Activating Real-Time Sync Triggers..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# EduSitePro connection string
EDUSITE_DB="postgresql://postgres.bppuzibjlxgfwrujzfsz:7nRkyAzTdgkLSw04@aws-0-af-south-1.pooler.supabase.com:6543/postgres"

echo -e "${YELLOW}Step 1:${NC} Deploying triggers to EduSitePro database..."

psql "$EDUSITE_DB" -f /home/king/Desktop/edudashpro/activate-realtime-sync.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Triggers deployed successfully"
else
  echo -e "${RED}✗${NC} Failed to deploy triggers"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 2:${NC} Verifying triggers are active..."

TRIGGER_COUNT=$(psql "$EDUSITE_DB" -t -c "
  SELECT COUNT(*) 
  FROM information_schema.triggers 
  WHERE event_object_table = 'registration_requests';
")

if [ "$TRIGGER_COUNT" -ge 3 ]; then
  echo -e "${GREEN}✓${NC} Found $TRIGGER_COUNT active triggers"
else
  echo -e "${RED}✗${NC} Expected 3 triggers, found $TRIGGER_COUNT"
  exit 1
fi

echo ""
echo -e "${YELLOW}Step 3:${NC} Listing active triggers..."

psql "$EDUSITE_DB" -c "
  SELECT 
    trigger_name, 
    event_manipulation as event
  FROM information_schema.triggers
  WHERE event_object_table = 'registration_requests'
  ORDER BY trigger_name;
"

echo ""
echo -e "${GREEN}✅ Real-Time Sync Activated!${NC}"
echo ""
echo "What happens now:"
echo "  • New registrations sync instantly (< 1 second)"
echo "  • POP uploads enable approve button instantly"
echo "  • Status changes sync instantly"
echo "  • Deletions sync instantly"
echo "  • pg_cron still runs every 5 min as safety net"
echo ""
echo "Test it:"
echo "  1. Upload POP in EduSitePro"
echo "  2. Check EduDashPro dashboard immediately"
echo "  3. Approve button should be enabled instantly"
echo ""
echo "Monitor logs:"
echo "  EduDashPro Edge Function Logs:"
echo "  https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/logs/edge-functions"
echo ""
