import { Platform } from 'react-native';
// TODO: Implement AdMob when ready for production
// import {
//   BannerAd,
//   InterstitialAd,
//   RewardedAd,
//   TestIds,
//   AdEventType,
//   RewardedAdEventType,
// } from 'react-native-google-mobile-ads';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { log, warn, debug, error as logError } from '@/lib/debug';
import Constants from 'expo-constants';

/**
 * AdMob Test IDs for development - Google's official test IDs
 * Production IDs should be configured when ready for production deployment
 */
const ADMOB_TEST_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712', 
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

/**
 * Production AdMob IDs - loaded from environment variables
 * Set these in EAS secrets or .env:
 * - ADMOB_BANNER_ANDROID / ADMOB_BANNER_IOS
 * - ADMOB_INTERSTITIAL_ANDROID / ADMOB_INTERSTITIAL_IOS
 * - ADMOB_REWARDED_ANDROID / ADMOB_REWARDED_IOS
 */
const getProductionIds = () => {
  const extra = Constants.expoConfig?.extra || {};
  return {
    android: {
      banner: extra.ADMOB_BANNER_ANDROID || process.env.ADMOB_BANNER_ANDROID || '',
      interstitial: extra.ADMOB_INTERSTITIAL_ANDROID || process.env.ADMOB_INTERSTITIAL_ANDROID || '',
      rewarded: extra.ADMOB_REWARDED_ANDROID || process.env.ADMOB_REWARDED_ANDROID || '',
    },
    ios: {
      banner: extra.ADMOB_BANNER_IOS || process.env.ADMOB_BANNER_IOS || '',
      interstitial: extra.ADMOB_INTERSTITIAL_IOS || process.env.ADMOB_INTERSTITIAL_IOS || '',
      rewarded: extra.ADMOB_REWARDED_IOS || process.env.ADMOB_REWARDED_IOS || '',
    },
  };
};

let isInitialized = false;

/**
 * Check if we should use production ad IDs
 * Uses production IDs when:
 * 1. Not in development mode (__DEV__ is false)
 * 2. admob_test_ids feature flag is false
 * 3. Production IDs are configured
 */
function shouldUseProductionIds(): boolean {
  // Always use test IDs in development
  if (__DEV__) return false;
  
  const flags = getFeatureFlagsSync();
  // Feature flag allows forcing test IDs in production for testing
  if (flags.admob_test_ids) return false;
  
  return true;
}

/**
 * Get appropriate ad unit ID based on testing mode
 */
function getAdUnitId(adType: keyof typeof ADMOB_TEST_IDS.android): string {
  const platform = Platform.OS as 'android' | 'ios';
  
  if (shouldUseProductionIds()) {
    const productionIds = getProductionIds();
    const productionId = productionIds[platform]?.[adType];
    
    // Fall back to test IDs if production IDs aren't configured
    if (productionId && productionId.startsWith('ca-app-pub-')) {
      debug(`AdMob: Using production ${adType} ad ID`);
      return productionId;
    }
    
    warn(`AdMob: Production ${adType} ad ID not configured, falling back to test ID`);
  }
  
  return ADMOB_TEST_IDS[platform][adType];
}

/**
 * Initialize AdMob - Simplified stub for development
 * TODO: Implement full AdMob integration when ready for production
 */
export async function initializeAdMob(): Promise<boolean> {
  if (isInitialized) return true;
  
  try {
    const flags = getFeatureFlagsSync();
    
    // Skip initialization on non-Android platforms during Android-only testing
    if (flags.android_only_mode && Platform.OS !== 'android') {
      log('AdMob initialization skipped: Android-only mode active');
      return false;
    }
    
    const useProductionAds = shouldUseProductionIds();
    
    // Stub implementation - no actual AdMob calls yet
    isInitialized = true;
    
    track('edudash.ads.initialized', {
      platform: Platform.OS,
      test_mode: !useProductionAds,
      production_mode: useProductionAds,
      android_only: flags.android_only_mode,
      stub_implementation: true,
    });
    
    log(`AdMob initialized - ${useProductionAds ? 'PRODUCTION' : 'TEST'} mode`);
    return true;
    
  } catch (error) {
    reportError(new Error('AdMob initialization failed'), { error });
    logError('Failed to initialize AdMob:', error);
    return false;
  }
}

// TODO: Implement actual AdMob ad loading when ready for production
// For now, using stubs to avoid TypeScript errors

/**
 * Show interstitial ad - Stub implementation
 */
export async function showInterstitialAd(): Promise<boolean> {
  const flags = getFeatureFlagsSync();
  
  // Skip on enterprise tier
  if (flags.enterprise_tier_enabled) {
    return false;
  }
  
  debug('AdMob Stub: Would show interstitial ad');
  track('edudash.ads.interstitial_stub_shown', {
    platform: Platform.OS,
  });
  return false; // Stub returns false for now
}

/**
 * Show rewarded ad - Stub implementation
 */
export async function showRewardedAd(): Promise<{
  shown: boolean;
  rewarded: boolean;
  reward?: { type: string; amount: number };
}> {
  const flags = getFeatureFlagsSync();
  
  // Skip on enterprise tier
  if (flags.enterprise_tier_enabled) {
    return { shown: false, rewarded: false };
  }
  
  debug('AdMob Stub: Would show rewarded ad');
  track('edudash.ads.rewarded_stub_shown', {
    platform: Platform.OS,
  });
  return { shown: false, rewarded: false }; // Stub returns false for now
}

/**
 * Check if interstitial ad is ready - Stub implementation
 */
export function isInterstitialReady(): boolean {
  return false; // Stub always returns false
}

/**
 * Check if rewarded ad is ready - Stub implementation
 */
export function isRewardedReady(): boolean {
  return false; // Stub always returns false
}

/**
 * Get banner ad unit ID for AdBanner component
 */
export function getBannerAdUnitId(): string {
  return getAdUnitId('banner');
}

/**
 * Clean up AdMob resources - Stub implementation
 */
export function cleanupAdMob(): void {
  debug('AdMob Stub: Cleanup called');
  isInitialized = false;
}
