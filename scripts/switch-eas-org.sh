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

# Project IDs
DASH_TS_PROJECT_ID="ae5db83e-e6fb-4a32-9973-e3ed5f8047ce"
DASHPRO_PROJECT_ID="c6933bb8-6f4d-4440-b223-0fb7e450d915"

# Slugs
DASH_TS_SLUG="comedudashproapp"
DASHPRO_SLUG="mark-1"

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

# Determine target project ID, slug, and update URL based on organization
if [ "$TARGET_ORG" = "$DASH_TS_ORG" ]; then
    TARGET_PROJECT_ID="$DASH_TS_PROJECT_ID"
    TARGET_SLUG="$DASH_TS_SLUG"
else
    TARGET_PROJECT_ID="$DASHPRO_PROJECT_ID"
    TARGET_SLUG="$DASHPRO_SLUG"
fi

# Switch organization
echo -e "${YELLOW}Switching from ${GREEN}$CURRENT_OWNER${YELLOW} to ${GREEN}$TARGET_ORG${NC}"

# Get current values
CURRENT_PROJECT_ID=$(grep -o '"projectId": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)
CURRENT_SLUG=$(grep -o '"slug": "[^"]*"' "$APP_JSON" | head -1 | cut -d'"' -f4)

# Use sed to replace the owner, projectId, slug, and update URL (macOS and Linux compatible)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"owner\": \"$CURRENT_OWNER\"/\"owner\": \"$TARGET_ORG\"/" "$APP_JSON"
    sed -i '' "s/\"slug\": \"$CURRENT_SLUG\"/\"slug\": \"$TARGET_SLUG\"/" "$APP_JSON"
    sed -i '' "s/\"projectId\": \"$CURRENT_PROJECT_ID\"/\"projectId\": \"$TARGET_PROJECT_ID\"/" "$APP_JSON"
    sed -i '' "s|https://u.expo.dev/$CURRENT_PROJECT_ID|https://u.expo.dev/$TARGET_PROJECT_ID|" "$APP_JSON"
else
    # Linux
    sed -i "s/\"owner\": \"$CURRENT_OWNER\"/\"owner\": \"$TARGET_ORG\"/" "$APP_JSON"
    sed -i "s/\"slug\": \"$CURRENT_SLUG\"/\"slug\": \"$TARGET_SLUG\"/" "$APP_JSON"
    sed -i "s/\"projectId\": \"$CURRENT_PROJECT_ID\"/\"projectId\": \"$TARGET_PROJECT_ID\"/" "$APP_JSON"
    sed -i "s|https://u.expo.dev/$CURRENT_PROJECT_ID|https://u.expo.dev/$TARGET_PROJECT_ID|" "$APP_JSON"
fi

# Verify changes
NEW_OWNER=$(grep -o '"owner": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)
NEW_PROJECT_ID=$(grep -o '"projectId": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)
NEW_SLUG=$(grep -o '"slug": "[^"]*"' "$APP_JSON" | head -1 | cut -d'"' -f4)

if [ "$NEW_OWNER" = "$TARGET_ORG" ] && [ "$NEW_PROJECT_ID" = "$TARGET_PROJECT_ID" ] && [ "$NEW_SLUG" = "$TARGET_SLUG" ]; then
    echo -e "${GREEN}✓ Successfully switched to organization: $TARGET_ORG${NC}"
    echo -e "  Owner: ${GREEN}$NEW_OWNER${NC}"
    echo -e "  Slug: ${GREEN}$NEW_SLUG${NC}"
    echo -e "  Project ID: ${GREEN}$NEW_PROJECT_ID${NC}"
    echo ""
    echo "You can now run:"
    echo "  - npx eas build --profile [profile] --platform android"
    echo "  - npx eas update --channel [channel] --message \"your message\""
else
    echo -e "${RED}Error: Failed to switch organization${NC}"
    exit 1
fi
