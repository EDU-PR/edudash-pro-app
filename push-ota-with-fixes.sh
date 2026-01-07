#!/bin/bash
# Push OTA update with all fixes

source ~/.nvm/nvm.sh
nvm use 20
npm run ota:playstore -- --message "🎉 Fixed: Payment updates, 3-grid layout, weekly AI reports added"
