#!/bin/bash

# =============================================================================
# Multi-Runtime OTA Update Script
# =============================================================================
# This script pushes OTA updates to multiple runtime versions.
# 
# IMPORTANT: Different native builds have different runtime versions:
# - Mark_1 (1.0.2): Uses runtime 1.0.2, channel "mark-1"  
# - Release 8 (1.0.7): Uses runtime 1.0.7, channel "production"
#
# OTA updates ONLY work for the SAME runtime version. If you push an update
# with runtime 1.0.7, devices on 1.0.2 will NOT receive it.
#
# Usage: ./scripts/push-ota-multi-runtime.sh "Your update message"
# =============================================================================

set -e

MESSAGE="${1:-Fix: Bug fixes and improvements}"
APP_JSON="app.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW} Multi-Runtime OTA Update${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
echo -e "Message: ${GREEN}${MESSAGE}${NC}"
echo ""

# Save current runtime version
CURRENT_RUNTIME=$(grep -o '"runtimeVersion": "[^"]*"' "$APP_JSON" | cut -d'"' -f4)
echo -e "Current runtimeVersion in app.json: ${GREEN}${CURRENT_RUNTIME}${NC}"
echo ""

# Define runtime versions and their channels
# Add or remove entries as needed
declare -A CHANNELS
CHANNELS["1.0.2"]="mark-1"
CHANNELS["1.0.7"]="production"

# Ask for confirmation
echo -e "${YELLOW}This will push OTA updates to:${NC}"
for runtime in "${!CHANNELS[@]}"; do
    channel="${CHANNELS[$runtime]}"
    echo -e "  - Runtime ${GREEN}${runtime}${NC} → Channel ${GREEN}${channel}${NC}"
done
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

# Push updates for each runtime version
for runtime in "${!CHANNELS[@]}"; do
    channel="${CHANNELS[$runtime]}"
    
    echo ""
    echo -e "${YELLOW}======================================${NC}"
    echo -e "${YELLOW} Pushing to runtime ${runtime} → channel ${channel}${NC}"
    echo -e "${YELLOW}======================================${NC}"
    
    # Update app.json runtimeVersion
    sed -i "s/\"runtimeVersion\": \"[^\"]*\"/\"runtimeVersion\": \"${runtime}\"/" "$APP_JSON"
    
    # Push the update
    NODE_OPTIONS="--max-old-space-size=8192" npx eas update \
        --channel "$channel" \
        --message "${MESSAGE} (runtime ${runtime})" \
        --non-interactive
    
    echo -e "${GREEN}✓ Update pushed to ${channel} (runtime ${runtime})${NC}"
done

# Restore original runtime version
echo ""
echo -e "${YELLOW}Restoring runtimeVersion to ${CURRENT_RUNTIME}...${NC}"
sed -i "s/\"runtimeVersion\": \"[^\"]*\"/\"runtimeVersion\": \"${CURRENT_RUNTIME}\"/" "$APP_JSON"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN} All updates pushed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "Summary:"
for runtime in "${!CHANNELS[@]}"; do
    channel="${CHANNELS[$runtime]}"
    echo -e "  ✓ Runtime ${GREEN}${runtime}${NC} → Channel ${GREEN}${channel}${NC}"
done
echo ""
echo -e "${YELLOW}NOTE: When 1.0.2 is deprecated, remove it from this script.${NC}"
