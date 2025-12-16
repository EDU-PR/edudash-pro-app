#!/bin/bash

# Deploy New Edge Functions
# Deploys process-cv-upload and dash-ai-automation functions to Supabase

set -e

echo "🚀 Deploying new Edge Functions to Supabase..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}❌ Error: supabase/functions directory not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Check if functions exist
if [ ! -f "supabase/functions/process-cv-upload/index.ts" ]; then
    echo -e "${RED}❌ Error: process-cv-upload function not found${NC}"
    exit 1
fi

if [ ! -f "supabase/functions/dash-ai-automation/index.ts" ]; then
    echo -e "${RED}❌ Error: dash-ai-automation function not found${NC}"
    exit 1
fi

# Deploy process-cv-upload
echo -e "${YELLOW}📦 Deploying process-cv-upload function...${NC}"
npx supabase functions deploy process-cv-upload --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy process-cv-upload${NC}"
    exit 1
}
echo -e "${GREEN}✅ process-cv-upload deployed successfully${NC}"
echo ""

# Deploy dash-ai-automation
echo -e "${YELLOW}📦 Deploying dash-ai-automation function...${NC}"
npx supabase functions deploy dash-ai-automation --no-verify-jwt || {
    echo -e "${RED}❌ Failed to deploy dash-ai-automation${NC}"
    exit 1
}
echo -e "${GREEN}✅ dash-ai-automation deployed successfully${NC}"
echo ""

echo -e "${GREEN}🎉 All Edge Functions deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify environment variables are set in Supabase Dashboard:"
echo "   - OPENAI_API_KEY (required for both)"
echo "   - ANTHROPIC_API_KEY (optional, for dash-ai-automation)"
echo ""
echo "2. Test the functions using the Supabase Dashboard or API"
echo ""
echo "3. Monitor function logs in Supabase Dashboard → Edge Functions → Logs"


