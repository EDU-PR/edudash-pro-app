#!/bin/bash

# Voice Transcription Enhancement Testing Script
# Tests the enhanced transcription system

echo "🎤 Voice Transcription Enhancement Testing"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if Edge Function is deployed
echo "📡 Test 1: Checking Edge Function deployment..."
FUNCTION_URL="https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/transcribe-audio"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL")

if [ "$RESPONSE" == "401" ] || [ "$RESPONSE" == "400" ]; then
    echo -e "${GREEN}✓${NC} Edge Function is deployed and responding"
else
    echo -e "${RED}✗${NC} Edge Function not accessible (HTTP $RESPONSE)"
fi
echo ""

# Test 2: Check TypeScript compilation
echo "📝 Test 2: Checking TypeScript compilation..."
if npx tsc --noEmit --project tsconfig.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} TypeScript compilation successful"
else
    echo -e "${RED}✗${NC} TypeScript compilation errors detected"
fi
echo ""

# Test 3: Check if files were modified correctly
echo "📄 Test 3: Verifying file modifications..."

FILES=(
    "services/DashAIAssistant.ts"
    "components/ai/VoiceRecorderSheet.tsx"
    "hooks/useVoiceController.ts"
    "supabase/functions/transcribe-audio/index.ts"
)

for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        echo -e "${GREEN}✓${NC} $FILE exists"
    else
        echo -e "${RED}✗${NC} $FILE not found"
    fi
done
echo ""

# Test 4: Check for new features in code
echo "🔍 Test 4: Checking for new features..."

# Check for progress callbacks
if grep -q "onProgress" services/DashAIAssistant.ts; then
    echo -e "${GREEN}✓${NC} Progress callback system implemented"
else
    echo -e "${RED}✗${NC} Progress callbacks not found"
fi

# Check for error handling
if grep -q "errorDetails" services/DashAIAssistant.ts; then
    echo -e "${GREEN}✓${NC} Enhanced error handling implemented"
else
    echo -e "${RED}✗${NC} Enhanced error handling not found"
fi

# Check for retry mechanism
if grep -q "retry" components/ai/VoiceRecorderSheet.tsx; then
    echo -e "${GREEN}✓${NC} Retry mechanism implemented"
else
    echo -e "${RED}✗${NC} Retry mechanism not found"
fi

# Check for file validation
if grep -q "blob.size > 25" services/DashAIAssistant.ts; then
    echo -e "${GREEN}✓${NC} File size validation implemented"
else
    echo -e "${RED}✗${NC} File size validation not found"
fi

# Check for provider fallback
if grep -q "usedFallback" supabase/functions/transcribe-audio/index.ts; then
    echo -e "${GREEN}✓${NC} Provider fallback implemented"
else
    echo -e "${RED}✗${NC} Provider fallback not found"
fi
echo ""

# Test 5: Check documentation
echo "📚 Test 5: Checking documentation..."
if [ -f "docs/VOICE_TRANSCRIPTION_ENHANCEMENTS.md" ]; then
    echo -e "${GREEN}✓${NC} Enhancement documentation created"
else
    echo -e "${RED}✗${NC} Documentation not found"
fi
echo ""

# Summary
echo "=========================================="
echo "✅ Testing Complete!"
echo ""
echo "Next Steps:"
echo "1. Deploy Edge Function: npx supabase functions deploy transcribe-audio --project-ref lvvvjywrmpcqrpvuptdi"
echo "2. Test in app with real voice recording"
echo "3. Monitor Edge Function logs for any issues"
echo "4. Verify progress bar shows correctly"
echo "5. Test error handling by turning off internet"
echo ""
echo "To view Edge Function logs:"
echo "  npx supabase functions logs transcribe-audio --project-ref lvvvjywrmpcqrpvuptdi"
echo ""
