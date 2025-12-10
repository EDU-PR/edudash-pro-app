#!/bin/bash

# Script to switch EAS organization owner in app.json
# Usage: ./scripts/switch-eas-org.sh [dash-ts-organization|dashpro]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_JSON="$PROJECT_ROOT/app.json"

# Default organizations
DASH_TS_ORG="dash-ts-organization"
DASHPRO_ORG="dashpro"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if app.json exists
if [ ! -f "$APP_JSON" ]; then
    echo -e "${RED}Error: app.json not found at $APP_JSON${NC}"
    exit 1
fi

# Get current owner
CURRENT_OWNER=$(grep -o '"owner": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)

if [ -z "$CURRENT_OWNER" ]; then
    echo -e "${RED}Error: Could not find 'owner' field in app.json${NC}"
    exit 1
fi

# If no argument provided, show current owner and prompt for new one
if [ -z "$1" ]; then
    echo -e "${YELLOW}Current organization: ${GREEN}$CURRENT_OWNER${NC}"
    echo ""
    echo "Available organizations:"
    echo "  1) $DASH_TS_ORG"
    echo "  2) $DASHPRO_ORG"
    echo ""
    read -p "Switch to (1/2): " choice
    
    case $choice in
        1)
            TARGET_ORG="$DASH_TS_ORG"
            ;;
        2)
            TARGET_ORG="$DASHPRO_ORG"
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
else
    TARGET_ORG="$1"
fi

# Validate target organization
if [ "$TARGET_ORG" != "$DASH_TS_ORG" ] && [ "$TARGET_ORG" != "$DASHPRO_ORG" ]; then
    echo -e "${RED}Error: Invalid organization. Must be '$DASH_TS_ORG' or '$DASHPRO_ORG'${NC}"
    exit 1
fi

# Check if already on target org
if [ "$CURRENT_OWNER" = "$TARGET_ORG" ]; then
    echo -e "${GREEN}Already on organization: $TARGET_ORG${NC}"
    exit 0
fi

# Switch organization
echo -e "${YELLOW}Switching from ${GREEN}$CURRENT_OWNER${YELLOW} to ${GREEN}$TARGET_ORG${NC}"

# Use sed to replace the owner field (macOS and Linux compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"owner\": \"$CURRENT_OWNER\"/\"owner\": \"$TARGET_ORG\"/" "$APP_JSON"
else
    # Linux
    sed -i "s/\"owner\": \"$CURRENT_OWNER\"/\"owner\": \"$TARGET_ORG\"/" "$APP_JSON"
fi

# Verify change
NEW_OWNER=$(grep -o '"owner": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)

if [ "$NEW_OWNER" = "$TARGET_ORG" ]; then
    echo -e "${GREEN}✓ Successfully switched to organization: $TARGET_ORG${NC}"
    echo ""
    echo "You can now run:"
    echo "  - npx eas build --profile [profile] --platform android"
    echo "  - npx eas update --channel [channel] --message \"your message\""
else
    echo -e "${RED}Error: Failed to switch organization${NC}"
    exit 1
fi
