# Vercel Environment Variables Checklist

## EduDashPro Web (Vercel Project)

**Project:** `edudashpro` or `edudashpro-web`

### Required Variables:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://lvvvjywrmpcqrpvuptdi.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (from web/.env.local)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EduDashPro service key)
- [ ] `NEXT_PUBLIC_EDUSITE_SUPABASE_URL` = `https://bppuzibjlxgfwrujzfsz.supabase.co`
- [ ] `NEXT_PUBLIC_EDUSITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EduSitePro anon key)
- [ ] `NEXT_PUBLIC_EDUSITEPRO_API_URL` = `https://edusitepro.edudashpro.org.za`
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` = `AIzaSyBcMcFWyTUZbptGtO89skTdiqTSFK7Wqw4`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `edudashpro.firebaseapp.com`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `edudashpro`
- [ ] `FIREBASE_PROJECT_ID` = `edudashpro`
- [ ] `FIREBASE_CLIENT_EMAIL` = `firebase-adminsdk-fbsvc@edudashpro.iam.gserviceaccount.com`
- [ ] `FIREBASE_PRIVATE_KEY` = (full private key from .env.local)
- [ ] `OPENAI_API_KEY` = (from .env.local)
- [ ] `FROM_EMAIL` = `noreply@edudashpro.org.za`
- [ ] `NEXT_PUBLIC_API_BASE` = `https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1`
- [ ] `NEXT_PUBLIC_ENVIRONMENT` = `production`
- [ ] `NEXT_PUBLIC_ENABLE_OFFLINE_MODE` = `true`
- [ ] `NEXT_PUBLIC_AGENTIC_AUTONOMY` = `assistant`
- [ ] `NEXT_PUBLIC_AGENTIC_ENABLED` = `false`
- [ ] `NEXT_PUBLIC_AGENTIC_PREDICTIVE` = `true`
- [ ] `NEXT_PUBLIC_AGENTIC_SEMANTIC_MEMORY` = `true`

---

## EduSitePro (Vercel Project)

**Project:** `edusitepro`

### Required Variables:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://bppuzibjlxgfwrujzfsz.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EduSitePro anon key)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EduSitePro service key)
- [ ] **`EDUDASH_SUPABASE_URL`** = `https://lvvvjywrmpcqrpvuptdi.supabase.co` ⚠️ **CRITICAL**
- [ ] **`EDUDASH_SERVICE_ROLE_KEY`** = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (EduDashPro service key) ⚠️ **CRITICAL**
- [ ] `FROM_EMAIL` = `noreply@edudashpro.org.za`
- [ ] `MARKETING_LEADS_EMAIL_TO` = `leads@edudashpro.org.za`
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://edusitepro.edudashpro.org.za`
- [ ] `NEXT_PUBLIC_ENABLE_ANALYTICS` = `true`
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` = `phc_yvYvnGn7Cd9iTsUPobcDsa6E1L2R4AMzrrAutYguIIF`
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
- [ ] `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` = `1b669422-7516-4452-82aa-f29828247158`
- [ ] `NEXT_PUBLIC_ANDROID_STORE_URL` = `https://play.google.com/store/apps/details?id=com.edudashpro`
- [ ] `NEXT_PUBLIC_IOS_STORE_URL` = `https://apps.apple.com/za/app/edudash-pro/id123456789`
- [ ] `NEXT_PUBLIC_EDUDASH_DEEP_LINK_BASE` = `edudashpro://`
- [ ] `NEXT_PUBLIC_APP_NAME` = `EduDash Pro`
- [ ] `NEXT_PUBLIC_DEFAULT_CURRENCY` = `ZAR`
- [ ] `NEXT_PUBLIC_DEFAULT_LOCALE` = `en-ZA`
- [ ] `NEXT_PUBLIC_DEFAULT_TIMEZONE` = `Africa/Johannesburg`
- [ ] `NEXT_PUBLIC_ENABLE_PWA` = `true`
- [ ] `NEXT_PUBLIC_ENABLE_OFFLINE_MODE` = `true`

---

## Critical for Registration Workflow

The approval workflow **will fail** without these cross-database credentials in EduSitePro:
- `EDUDASH_SUPABASE_URL`
- `EDUDASH_SERVICE_ROLE_KEY`

These allow EduSitePro's approval API to sync approved organizations to EduDashPro database.

---

## How to Add in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (edudashpro or edusitepro)
3. Go to Settings → Environment Variables
4. Add each variable with value
5. Select environments: Production, Preview, Development (or just Production)
6. Click Save
7. **Redeploy** your application for changes to take effect

---

## Testing Locally

All environment variables are now configured in:
- `/home/king/Desktop/edudashpro/web/.env.local` ✅
- `/home/king/Desktop/edusitepro/.env.local` ✅

Both dev servers should work correctly for testing the registration approval workflow.
