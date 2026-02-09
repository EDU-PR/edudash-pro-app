import { Platform } from 'react-native';
import { log, warn, debug } from '@/lib/debug';
import { isUnderAgeOfConsent } from '@/lib/services/consentService';

let initialized = false;

/**
 * Initialize mobile ads with COPPA-compliant age-of-consent check.
 *
 * @param dateOfBirth - The current user's DOB for dynamic COPPA tagging.
 *                      When null/undefined, defaults to safe (no child-directed).
 */
export async function startAds(dateOfBirth?: string | null) {
  if (initialized) return; initialized = true;
  if (Platform.OS === 'web') return; // Skip on web
  if (process.env.EXPO_PUBLIC_ENABLE_ADS === '0') return;

  const isTest = (__DEV__ as boolean) || process.env.EXPO_PUBLIC_ENABLE_TEST_ADS === 'true';
  
  try {
    // Dynamically import ads module only on mobile platforms
    const { default: mobileAds, MaxAdContentRating } = require('react-native-google-mobile-ads');

    // COPPA: dynamically check user's age instead of hardcoding false
    const underAge = isUnderAgeOfConsent(dateOfBirth);

    const config: any = {
      maxAdContentRating: underAge ? MaxAdContentRating.G : MaxAdContentRating.G,
      tagForChildDirectedTreatment: underAge,
      tagForUnderAgeOfConsent: underAge,
    };
    if (isTest) {
      config.testDeviceIdentifiers = ['EMULATOR'];
    }

    await mobileAds()
      .setRequestConfiguration(config)
      .then(() => mobileAds().initialize());

    debug('Ads initialized', { platform: Platform.OS, isTest });
  } catch (error) {
    warn('Failed to initialize ads:', error);
  }
}
