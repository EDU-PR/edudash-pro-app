#!/bin/bash
# Push OTA update to EduPro-Final (Mark_2 1.0.22 build on Play Store)
# Project: edudashproplay-store/edupro-final (accd5738-9ee6-434c-a3be-668d9674f541)

set -e

# Load nvm if available
if [ -f ~/.nvm/nvm.sh ]; then
  source ~/.nvm/nvm.sh
  nvm use 20
fi

# Default message
MESSAGE="${1:-OTA Update}"

echo "🚀 Pushing OTA update to Mark_2 1.0.22 (Play Store)..."
echo "📝 Message: $MESSAGE"
echo ""

# Run the OTA update
npm run ota -- --message "$MESSAGE"

echo ""
echo "✅ OTA update pushed successfully!"
echo "📱 Users on Mark_2 1.0.22 will receive this update automatically."
