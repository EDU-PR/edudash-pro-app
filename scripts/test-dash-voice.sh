#!/bin/bash
# Dash AI Voice Testing Script
# Tests male voice implementation and settings

echo "🎤 Dash AI Voice Testing Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Checking Dash AI Settings File...${NC}"
if grep -q "voiceType: 'male'" app/screens/dash-ai-settings.tsx; then
    echo -e "${GREEN}✓ Male voice default found in settings${NC}"
else
    echo -e "${RED}✗ Male voice default NOT set${NC}"
fi

echo ""
echo -e "${BLUE}2. Checking Voice Selection Logic...${NC}"
if grep -q "gender === 'male'" app/screens/dash-ai-settings.tsx; then
    echo -e "${GREEN}✓ Male gender selection logic found${NC}"
else
    echo -e "${RED}✗ Male gender selection logic missing${NC}"
fi

echo ""
echo -e "${BLUE}3. Checking Voice Display Bug...${NC}"
if grep -q "voiceSettings?.voice === 'male'" app/screens/dash-ai-settings.tsx; then
    echo -e "${GREEN}✓ Voice display logic fixed${NC}"
else
    echo -e "${RED}✗ Voice display logic still has bug${NC}"
fi

echo ""
echo -e "${BLUE}4. Checking DashAIAssistant Voice Settings...${NC}"
if grep -q "voice: 'male'" services/DashAIAssistant.ts; then
    echo -e "${GREEN}✓ Male voice in DashAIAssistant default personality${NC}"
else
    echo -e "${YELLOW}⚠ Check DashAIAssistant default personality${NC}"
fi

echo ""
echo -e "${BLUE}5. Checking Voice Gender Toggle UI...${NC}"
if grep -q "Voice Gender" app/screens/dash-ai-settings.tsx; then
    echo -e "${GREEN}✓ Voice gender toggle UI added${NC}"
else
    echo -e "${RED}✗ Voice gender toggle UI missing${NC}"
fi

echo ""
echo -e "${BLUE}6. Project TypeScript Check...${NC}"
npm run typecheck 2>&1 | head -20

echo ""
echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Manual Testing Steps:${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""
echo "1. Start the app:"
echo "   npm run dev:android"
echo ""
echo "2. Navigate to Dash AI Settings:"
echo "   Open Dash → Settings icon (top right)"
echo ""
echo "3. Test Voice Gender Toggle:"
echo "   - Check that Male button is highlighted by default"
echo "   - Tap Female button, should switch"
echo "   - Tap Male button, should switch back"
echo ""
echo "4. Test Voice:"
echo "   - Tap 'Test Voice' button"
echo "   - Verify male voice speaks"
echo ""
echo "5. Check Voice Display:"
echo "   - Scroll to 'Current Settings' section"
echo "   - 'Voice Type' should show 'Male'"
echo ""
echo "6. Test Fresh Install:"
echo "   - Clear app data or reinstall"
echo "   - Open Dash Settings"
echo "   - Default should be Male voice"
echo ""
echo -e "${GREEN}Testing script complete!${NC}"
