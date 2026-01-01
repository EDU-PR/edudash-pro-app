import React from 'react';
import Purchases, { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { 
  REVENUECAT_ENTITLEMENTS, 
  REVENUECAT_PRODUCT_TO_TIER, 
  getTierFromRevenueCatProduct,
  getCapabilityTier,
  getTierDisplayName,
  type TierNameAligned 
} from '../tiers';

// RevenueCat Configuration
export const REVENUECAT_CONFIG = {
  // RevenueCat Public SDK Keys (safe to expose client-side)
  // Get from RevenueCat Dashboard → Project Settings → API Keys
  API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_IOS_SDK_KEY || '',
  API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_SDK_KEY || '',
  
  // Product IDs - Must match Google Play Console / App Store Connect
  // Current offerings in RevenueCat:
  // - edudash_starter_monthly (Starter Plan) -> parent_starter
  // - edudash_premium_monthly (Premium Plan) -> parent_plus
  PRODUCT_IDS: {
    // Parent plans (currently configured)
    STARTER_MONTHLY: 'edudash_starter_monthly',
    STARTER_ANNUAL: 'edudash_starter_annual',
    PREMIUM_MONTHLY: 'edudash_premium_monthly',
    PREMIUM_ANNUAL: 'edudash_premium_annual',
    // School plans (for future)
    SCHOOL_STARTER_MONTHLY: 'edudash_school_starter_monthly',
    SCHOOL_PREMIUM_MONTHLY: 'edudash_school_premium_monthly',
    SCHOOL_PRO_MONTHLY: 'edudash_school_pro_monthly',
  },
  
  // Entitlement IDs - Must be created in RevenueCat dashboard
  // and attached to products
  ENTITLEMENTS: REVENUECAT_ENTITLEMENTS,
};

// Track initialization state
let isRevenueCatInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Should be called early in the app lifecycle
 */
export async function initializeRevenueCat(): Promise<void> {
  // Don't reinitialize if already done
  if (isRevenueCatInitialized) {
    console.log('RevenueCat already initialized');
    return;
  }
  
  try {
    const apiKey = Platform.select({
      ios: REVENUECAT_CONFIG.API_KEY_IOS,
      android: REVENUECAT_CONFIG.API_KEY_ANDROID,
      default: REVENUECAT_CONFIG.API_KEY_ANDROID,
    });

    if (!apiKey) {
      console.warn('RevenueCat API key not configured');
      return;
    }

    await Purchases.configure({
      apiKey,
    });

    // Enable debug logs in development
    if (__DEV__) {
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }

    isRevenueCatInitialized = true;
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
  }
}

/**
 * Set user ID for RevenueCat
 * Format: "user_${userId}" or "school_${preschoolId}_${userId}"
 */
export async function identifyRevenueCatUser(
  userId: string,
  preschoolId?: string
): Promise<void> {
  try {
    const appUserId = preschoolId 
      ? `school_${preschoolId}_${userId}`
      : `user_${userId}`;
    
    await Purchases.logIn(appUserId);
    console.log('RevenueCat user identified:', appUserId);
  } catch (error) {
    console.error('Failed to identify RevenueCat user:', error);
  }
}

/**
 * Log out the current user from RevenueCat
 */
export async function logoutRevenueCatUser(): Promise<void> {
  try {
    await Purchases.logOut();
    console.log('RevenueCat user logged out');
  } catch (error) {
    console.error('Failed to logout RevenueCat user:', error);
  }
}

/**
 * Get current customer info and entitlements
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has access to a specific feature tier
 */
export async function hasFeatureAccess(tier: 'starter' | 'premium' | 'enterprise'): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return false;

    const entitlementId = REVENUECAT_CONFIG.ENTITLEMENTS[tier.toUpperCase() as keyof typeof REVENUECAT_CONFIG.ENTITLEMENTS];
    if (!entitlementId) return false;
    
    const entitlement = customerInfo.entitlements.active[entitlementId];
    return entitlement?.isActive === true;
  } catch (error) {
    console.error('Failed to check feature access:', error);
    return false;
  }
}

/**
 * Get the user's highest active subscription tier
 * Returns canonical tier_name_aligned value
 */
export async function getActiveSubscriptionTier(): Promise<TierNameAligned> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) return 'free';

    // Check entitlements in order of priority (highest to lowest)
    const entitlements = customerInfo.entitlements.active;
    
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.ENTERPRISE]?.isActive) return 'school_enterprise';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.PRO]?.isActive) return 'school_pro';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM]?.isActive) return 'parent_plus';
    if (entitlements[REVENUECAT_CONFIG.ENTITLEMENTS.STARTER]?.isActive) return 'parent_starter';
    
    return 'free';
  } catch (error) {
    console.error('Failed to get active subscription tier:', error);
    return 'free';
  }
}

/**
 * Get available products for purchase
 */
export async function getAvailableProducts() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Failed to get available products:', error);
    return null;
  }
}

/**
 * Check if RevenueCat is initialized
 */
export function isInitialized(): boolean {
  return isRevenueCatInitialized;
}

/**
 * Ensure RevenueCat is initialized before making calls
 */
export async function ensureInitialized(): Promise<boolean> {
  if (isRevenueCatInitialized) return true;
  
  try {
    await initializeRevenueCat();
    return isRevenueCatInitialized;
  } catch (error) {
    console.error('Failed to ensure RevenueCat initialization:', error);
    return false;
  }
}

/**
 * Purchase a product (ensures SDK is initialized first)
 */
export async function purchaseProduct(productId: string): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    // Ensure SDK is initialized before purchase
    const initialized = await ensureInitialized();
    if (!initialized) {
      return {
        success: false,
        error: 'RevenueCat SDK not initialized. Please try again.',
      };
    }
    
    const { customerInfo } = await Purchases.purchaseProduct(productId);
    return {
      success: true,
      customerInfo,
    };
  } catch (error: any) {
    console.error('Purchase failed:', error);
    
    // Handle different error types
    if (error.userCancelled) {
      return {
        success: false,
        error: 'Purchase cancelled by user',
      };
    }
    
    // Check for singleton error
    if (error.message?.includes('singleton') || error.message?.includes('configure')) {
      // Try to initialize and retry once
      try {
        await initializeRevenueCat();
        const { customerInfo } = await Purchases.purchaseProduct(productId);
        return {
          success: true,
          customerInfo,
        };
      } catch (retryError: any) {
        return {
          success: false,
          error: retryError.message || 'Purchase failed after retry',
        };
      }
    }
    
    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return {
      success: true,
      customerInfo,
    };
  } catch (error: any) {
    console.error('Restore purchases failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore purchases',
    };
  }
}

/**
 * Map subscription tier to product IDs
 */
export function getProductIdsForTier(tier: string, billing: 'monthly' | 'annual'): string[] {
  const suffix = billing === 'annual' ? '_annual' : '_monthly';
  const prefix = `edudash_${tier}`;
  return [`${prefix}${suffix}`];
}

/**
 * Hook to get RevenueCat customer info with caching
 */
export function useRevenueCatCustomerInfo() {
  const [customerInfo, setCustomerInfo] = React.useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchCustomerInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const info = await getCustomerInfo();
        
        if (isMounted) {
          setCustomerInfo(info);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch customer info');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomerInfo();

    // Set up listener for customer info updates
    Purchases.addCustomerInfoUpdateListener((info) => {
      if (isMounted) {
        setCustomerInfo(info);
      }
    });

    return () => {
      isMounted = false;
      // No explicit unsubscribe available in this SDK wrapper
    };
  }, []);

  return { customerInfo, isLoading, error, refetch: () => getCustomerInfo() };
}