#!/usr/bin/env bash
set -euo pipefail

echo "[cache:clear] Cleaning common Expo/Metro/Next caches..."

# Expo / Metro
rm -rf .expo .expo-shared .cache dist || true
find /tmp -maxdepth 1 -type d -name 'metro-*' -exec rm -rf {} + 2>/dev/null || true

# Next/Vercel (web)
rm -rf .next web/.next web/out web/dist || true

# Tooling caches
rm -rf node_modules/.cache web/node_modules/.cache 2>/dev/null || true

echo "[cache:clear] Done."


