# Payment Integrations Checklist

## RevenueCat Configuration

### Status: ⚠️ **Needs Verification**

**Current Configuration:**
- Android SDK Key found in `.env`: `EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY=goog_XtLlWOFsGNGANSymzVcBvAtzKRq`
- Code expects: `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` (naming mismatch)
- iOS SDK Key: Not found in `.env`

**Required Actions:**
1. ✅ **Verify Key is Production**: The key `goog_XtLlWOFsGNGANSymzVcBvAtzKRq` should be from your RevenueCat production project (not sandbox/test)
2. ⚠️ **Add to EAS Secrets**: Set in EAS Build secrets for production builds:
   - `EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY` (or fix code to match)
   - `EXPO_PUBLIC_REVENUECAT_IOS_SDK_KEY` (if iOS app exists)
3. ⚠️ **Fix Variable Name Mismatch**: 
   - Code uses: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
   - .env has: `EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY`
   - **Recommendation**: Update code to use `*_SDK_KEY` naming (standard convention)

**Where to Find Production Keys:**
1. Log into RevenueCat dashboard
2. Go to your project → Settings → API Keys
3. Copy the **Public SDK Key** (starts with `goog_` for Android or `appl_` for iOS)
4. Ensure you're viewing the **Production** project, not Sandbox/Test

**Verification:**
- [ ] Android SDK Key is from production project
- [ ] iOS SDK Key added (if needed)
- [ ] Keys added to EAS Build secrets
- [ ] Variable naming fixed/standardized

---

## PayFast Configuration

### Status: ⚠️ **Likely Using Sandbox Mode**

**Current Configuration:**
- **Default mode**: `sandbox` (see `supabase/functions/payfast-create-payment/index.ts:203`)
- **Mode is controlled by**: Supabase Edge Function secret `PAYFAST_MODE`
- **Required secrets in Supabase**:
  - `PAYFAST_MODE` (should be `production`, not `sandbox`)
  - `PAYFAST_MERCHANT_ID` (production merchant ID)
  - `PAYFAST_MERCHANT_KEY` (production merchant key)
  - `PAYFAST_PASSPHRASE` (required for production signatures)

**PayFast URLs:**
- Sandbox: `https://sandbox.payfast.co.za/eng/process`
- Production: `https://www.payfast.co.za/eng/process`

**Critical Notes:**
- ⚠️ PayFast sandbox does **NOT** use passphrase in signatures
- ⚠️ PayFast production **REQUIRES** passphrase in signatures
- ✅ Code correctly handles both modes (see signature generation logic)

**Required Actions:**
1. **Check Supabase Edge Function Secrets**:
   ```bash
   # In Supabase Dashboard → Edge Functions → Secrets
   # OR via CLI:
   supabase secrets list
   ```

2. **Set Production Secrets** (if not already set):
   ```bash
   supabase secrets set PAYFAST_MODE=production
   supabase secrets set PAYFAST_MERCHANT_ID=your_production_merchant_id
   supabase secrets set PAYFAST_MERCHANT_KEY=REDACTED
   supabase secrets set PAYFAST_PASSPHRASE=REDACTED
   ```

3. **Verify Webhook URLs**:
   - Production webhook should be: `https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/payfast-webhook`
   - Configure this URL in PayFast merchant dashboard → Settings → Integration

**Where to Find Production Credentials:**
1. Log into PayFast merchant dashboard
2. Go to Settings → Integration
3. Copy:
   - Merchant ID
   - Merchant Key
   - Passphrase (if enabled - **required for production**)
4. Verify you're viewing **Live** credentials, not Sandbox

**Verification Checklist:**
- [ ] `PAYFAST_MODE=production` in Supabase secrets (not `sandbox`)
- [ ] Production `PAYFAST_MERCHANT_ID` is set
- [ ] Production `PAYFAST_MERCHANT_KEY` is set
- [ ] Production `PAYFAST_PASSPHRASE` is set (required!)
- [ ] Webhook URL configured in PayFast dashboard
- [ ] Test a payment to verify production mode works

---

## Verification Commands

### Check EAS Secrets (RevenueCat):
```bash
eas secret:list --scope project
```

### Check Supabase Secrets (PayFast):
```bash
supabase secrets list
```

### Test PayFast Mode (after deployment):
Check Edge Function logs to see which URL is being used:
- Sandbox: `https://sandbox.payfast.co.za/...`
- Production: `https://www.payfast.co.za/...`

---

## Summary

**RevenueCat**: ⚠️ Needs verification and EAS secrets setup  
**PayFast**: ⚠️ Likely in sandbox mode - needs Supabase secrets update

**Next Steps:**
1. Verify RevenueCat keys are production keys
2. Add RevenueCat keys to EAS secrets
3. Check/update Supabase PayFast secrets to production mode
4. Test both integrations end-to-end

