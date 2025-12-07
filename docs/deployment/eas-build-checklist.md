# EAS Build Checklist

Comprehensive pre-build validation for EduDash Pro Android/iOS builds.

## 📋 Prerequisites

### 1. Environment Variables

#### Required in `.env.local` (for local development)
```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Daily.co (for voice/video calls)
DAILY_API_KEY=<your-daily-api-key>
```

#### Required in EAS Build Secrets
Set via EAS CLI or Expo Dashboard:
```bash
eas secret:create --scope project --name DAILY_API_KEY --value <your-daily-api-key> --type string
```

**Verify in `eas.json`:**
- ✅ `EXPO_PUBLIC_DAILY_API_KEY` in all profiles (development, preview, production)
- ✅ References `${DAILY_API_KEY}` from secrets

### 2. Supabase Edge Functions

#### Deploy Call-Related Functions
```bash
# Navigate to project root
cd /home/king/Desktop/edudashpro

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref lvvvjywrmpcqrpvuptdi

# Deploy the functions
supabase functions deploy daily-token
supabase functions deploy daily-rooms

# Verify deployment
supabase functions list
```

#### Add Secret to Supabase
```bash
# Via Supabase CLI
supabase secrets set DAILY_API_KEY=<your-daily-api-key>

# Or via Dashboard:
# 1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/edge-functions
# 2. Click "Edge Functions" → "Secrets"
# 3. Add secret: DAILY_API_KEY = <your-daily-api-key>
```

**Verify Functions:**
```bash
# Test daily-token locally
supabase functions serve daily-token

# In another terminal, test with curl:
curl -i --location --request POST 'http://localhost:54321/functions/v1/daily-token' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"roomName":"test-room","userName":"Test User","isOwner":true}'

# Test daily-rooms
curl -i --location --request POST 'http://localhost:54321/functions/v1/daily-rooms' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"test-room-123","isPrivate":true,"expiryMinutes":60}'
```

### 3. Dependencies

#### Install Native Modules
```bash
# Install all expo modules for current SDK
npx expo install

# Specifically install call-related dependencies
npx expo install expo-camera
npx expo install @daily-co/react-native-daily-js
npx expo install @daily-co/react-native-webrtc
npx expo install @config-plugins/react-native-webrtc

# Verify installation
npm list expo-camera @daily-co/react-native-daily-js
```

#### Run Prebuild (Important!)
```bash
# Generate native folders before first build
npm run prebuild

# Or with clean flag to regenerate
npx expo prebuild --clean
```

### 4. Configuration Files

#### Verify `app.json`
- ✅ iOS permissions: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`
- ✅ iOS background modes: `["audio", "voip"]`
- ✅ Android permissions: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `CAMERA`
- ✅ Config plugins: `@config-plugins/react-native-webrtc`

#### Verify `eas.json`
- ✅ `credentialsSource: "remote"` in all profiles
- ✅ `EXPO_PUBLIC_DAILY_API_KEY` environment variable
- ✅ Channel names match deployment strategy

### 5. Code Quality

#### TypeScript Validation
```bash
# Check for TypeScript errors
npm run typecheck

# If errors exist, fix them or temporarily disable in eas.json:
# "eas-build-post-install": "echo 'Typecheck disabled temporarily'"
```

#### Lint SQL Migrations
```bash
# If you have new migrations
npm run lint:sql
```

#### Test Build Locally
```bash
# Android preview build (faster, for testing)
npm run build:android:preview

# Full production APK (local)
npm run build:android:apk
```

---

## 🚀 Build Commands

### Development Build
```bash
eas build --profile development --platform android
```
**Use for:** Testing new features with development client

### Preview Build (APK)
```bash
npm run build:android:preview
# Or: eas build --profile preview --platform android --local
```
**Use for:** Internal testing, stakeholder demos

### Production Build (AAB for Play Store)
```bash
npm run build:android:aab
# Or: eas build --profile production --platform android --clear-cache --non-interactive
```
**Use for:** Play Store submissions

### Production Build (APK for Direct Distribution)
```bash
npm run build:android:apk
# Or: eas build --profile production-apk --platform android --local
```
**Use for:** Direct APK downloads (website, side-loading)

---

## ✅ Pre-Build Validation Checklist

### Critical (Must Pass)
- [ ] `DAILY_API_KEY` secret set in EAS and Supabase
- [ ] `daily-token` edge function deployed and tested
- [ ] `daily-rooms` edge function deployed and tested
- [ ] `expo-camera` installed (run `npm list expo-camera`)
- [ ] `app.json` has iOS background modes
- [ ] `eas.json` has `EXPO_PUBLIC_DAILY_API_KEY` in all profiles
- [ ] No TypeScript errors in call-related files:
  - `components/calls/CallProvider.tsx`
  - `components/calls/VoiceCallInterface.tsx`
  - `components/calls/VideoCallInterface.tsx`
  - `components/calls/IncomingCallOverlay.tsx`
  - `app/screens/parent-message-thread.tsx`
  - `app/screens/teacher-message-thread.tsx`

### High Priority (Should Pass)
- [ ] `npm run prebuild` executed successfully
- [ ] No lint errors: `npm run lint`
- [ ] Feature flags enabled in database:
  ```sql
  SELECT * FROM feature_flags WHERE flag_key IN ('video_calls_enabled', 'voice_calls_enabled');
  ```
- [ ] Test user exists with call permissions
- [ ] Daily.co account has sufficient credits/quota

### Medium Priority (Nice to Have)
- [ ] `npm run typecheck` passes (or acknowledged errors documented)
- [ ] All dependencies up-to-date: `npm outdated`
- [ ] No high/critical security vulnerabilities: `npm audit`
- [ ] Git working directory clean (no uncommitted changes)
- [ ] Version number incremented in `app.json`

---

## 🔍 Troubleshooting Common Issues

### Issue: "Cannot find module '@expo/cli/build/src/export/embed/exportEmbedAsync'"
**Root Cause:** `expo-updates@0.28.x` requires `@expo/cli` to be resolvable from the project root, but npm nested it inside `expo/node_modules/`.

**Solution:**
```bash
# Add @expo/cli as explicit devDependency
npm install @expo/cli@0.24.22 --save-dev

# Verify it's at root level
node -e "require.resolve('@expo/cli')"

# Test local export
npx expo export --platform android --output-dir ./dist-test
rm -rf ./dist-test

# Rebuild with cache clear
eas build --platform android --profile preview --clear-cache
```

### Issue: Build fails during "Run Prebuild" phase
**Root Cause:** Local `android/` or `ios/` folders were uploaded to EAS, conflicting with Prebuild generation.

**Solution:**
```bash
# Ensure .easignore has these at the TOP
echo "android/" >> .easignore
echo "ios/" >> .easignore

# Or edit .easignore to start with:
# android/
# ios/

# Rebuild
eas build --platform android --profile preview --clear-cache
```

### Issue: "Module @daily-co/react-native-daily-js does not exist"
**Solution:**
```bash
rm -rf node_modules
npm install
npx expo prebuild --clean
```

### Issue: "Unable to resolve module ./theme"
**Solution:** Already fixed! Import paths changed from `@/components/messaging/theme` to relative paths `../../components/messaging/theme`

### Issue: "daily-token function returns 401"
**Solution:**
1. Check Supabase edge function logs: `supabase functions logs daily-token`
2. Verify `DAILY_API_KEY` is set in Supabase secrets
3. Test authentication by calling function with valid user token

### Issue: "Call UI doesn't appear"
**Solution:** Already fixed! `CallProvider.tsx` now renders `VoiceCallInterface`, `VideoCallInterface`, and `IncomingCallOverlay` components.

### Issue: "Android build fails with AndroidManifest.xml errors"
**Solution:** Already handled by `plugins/withAndroidManifestFix.js` config plugin

### Issue: "Type errors during build"
**Solution (Temporary):**
```json
// In eas.json, under "build":
"eas-build-post-install": "echo 'Typecheck temporarily disabled...'"
```

---

## 📊 Post-Build Validation

### After Build Completes
1. **Download the APK/AAB** from EAS dashboard or local `builds/` folder
2. **Install on test device:**
   ```bash
   adb install path/to/your-app.apk
   ```
3. **Test call functionality:**
   - Initiate voice call from parent message thread
   - Initiate video call from parent message thread
   - Receive incoming call (test with another user/device)
   - Check audio/video quality
   - Verify call end/reject flows

### Verify in Production
- [ ] Calls connect successfully
- [ ] Audio is clear (no echo, feedback)
- [ ] Video displays correctly (if video call)
- [ ] Call UI appears and functions properly
- [ ] Call signals (incoming/outgoing) work via Supabase Realtime
- [ ] Daily.co usage tracked in dashboard (billing)

---

## 🔒 Security Considerations

### Never Commit
- ❌ `DAILY_API_KEY` to git
- ❌ Service role keys to git
- ❌ Production database credentials

### Use Secrets Management
- ✅ EAS secrets for `DAILY_API_KEY`
- ✅ Supabase secrets for edge function `DAILY_API_KEY`
- ✅ Environment-specific credentials in `eas.json` per profile

### Validate Permissions
- ✅ Calls feature-flagged (`video_calls_enabled`, `voice_calls_enabled`)
- ✅ User authentication required for Daily.co token generation
- ✅ RLS policies on `active_calls` table enforce tenant isolation

---

## 📚 Additional Resources

- **EAS Build Documentation:** https://docs.expo.dev/build/introduction/
- **Daily.co React Native Docs:** https://docs.daily.co/reference/react-native
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **EAS Secrets:** https://docs.expo.dev/build-reference/variables/#using-secrets-in-environment-variables
- **Project WARP.md:** `/home/king/Desktop/edudashpro/WARP.md`

---

## 🎯 Quick Start Command Sequence

For a production build from scratch:

```bash
# 1. Ensure environment is configured
export DAILY_API_KEY="<your-key>"

# 2. Install dependencies
npm install

# 3. Deploy edge function
supabase functions deploy daily-token
supabase secrets set DAILY_API_KEY="$DAILY_API_KEY"

# 4. Set EAS secret
eas secret:create --scope project --name DAILY_API_KEY --value "$DAILY_API_KEY" --type string

# 5. Validate code
npm run typecheck || echo "TypeScript errors acknowledged"
npm run lint

# 6. Run prebuild
npx expo prebuild --clean

# 7. Build for production (AAB)
npm run build:android:aab

# 8. Or build APK locally
npm run build:android:apk
```

---

## ⚠️ Critical EAS Build Requirements (SDK 53+)

These requirements were discovered through debugging build failures and are **non-negotiable** for successful EAS builds.

### 1. `.easignore` MUST Include Native Folders

For CNG (Continuous Native Generation) / Prebuild workflow:

```bash
# TOP of .easignore - CRITICAL
android/
ios/
```

**Why:** EAS Prebuild generates fresh `android/` and `ios/` folders on the build server. If you upload existing local native folders, they can contain stale configurations, wrong SDK versions, or corrupted files that cause build failures.

**Signs of this issue:**
- Build fails with "Cannot find module '@expo/cli/build/src/export/embed/exportEmbedAsync'"
- Build fails during "Run Prebuild" phase
- Upload size is >10MB (should be ~5MB without native folders)

### 2. `@expo/cli` as devDependency

Starting with Expo SDK 53 and `expo-updates@0.28.x`, `@expo/cli` **must be resolvable from the project root**:

```json
// package.json
{
  "devDependencies": {
    "@expo/cli": "0.24.22"
  }
}
```

**Why:** `expo-updates` requires `@expo/cli/build/src/export/embed/exportEmbedAsync` at build time. npm may nest `@expo/cli` inside `node_modules/expo/node_modules/` instead of hoisting it to the root. Adding it as an explicit devDependency ensures it's always at the root level.

**Signs of this issue:**
- "Cannot find module '@expo/cli/build/src/export/embed/exportEmbedAsync'"
- Build fails during the export/bundling phase
- Local `npx expo export --platform android` fails

### 3. EAS CLI Version

```json
// eas.json
{
  "cli": {
    "version": ">= 16.0.0"
  }
}
```

Ensure your global EAS CLI is updated:
```bash
npm install -g eas-cli@latest
eas --version  # Should be 16.x or higher
```

### 4. Version Compatibility Matrix (SDK 53)

| Package | Required Version | Notes |
|---------|-----------------|-------|
| expo | 53.0.x | SDK 53 |
| expo-updates | 0.28.x | Requires @expo/cli at root |
| @expo/cli | 0.24.x | Must be devDependency |
| react-native | 0.79.x | Compatible with SDK 53 |
| eas-cli | 16.x+ | Global installation |

### 5. Pre-Build Verification Commands

Always run these before `eas build`:

```bash
# 1. Verify @expo/cli is resolvable from root
node -e "require.resolve('@expo/cli')"

# 2. Test local export (catches module resolution issues)
npx expo export --platform android --output-dir ./dist-test
rm -rf ./dist-test  # Cleanup

# 3. Check .easignore includes native folders
head -5 .easignore  # Should show android/ and ios/

# 4. Verify upload size will be reasonable
du -sh . --exclude=node_modules --exclude=android --exclude=ios --exclude=.git
# Should be ~5-10MB
```

### 6. Recovery from Failed Builds

If builds fail with module resolution errors:

```bash
# Full reset
rm -rf node_modules package-lock.json
npm install

# Ensure @expo/cli is at root
npm install @expo/cli@0.24.22 --save-dev

# Verify fix
node -e "require.resolve('@expo/cli')"
npx expo export --platform android --output-dir ./dist-test
rm -rf ./dist-test

# Rebuild with cache clear
eas build --platform android --profile preview --clear-cache
```

---

**Last Updated:** December 7, 2025  
**Maintainer:** EduDash Pro DevOps Team  
**Related Files:**
- `eas.json` - Build configuration
- `app.json` - App manifest  
- `.easignore` - EAS upload exclusions (critical for Prebuild)
- `package.json` - Must include `@expo/cli` as devDependency
- `supabase/functions/daily-token/index.ts` - Token generation
- `components/calls/CallProvider.tsx` - Call system provider
