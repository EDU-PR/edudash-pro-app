/**
 * Canonical Tier System for EduDash Pro
 * 
 * This is the SINGLE SOURCE OF TRUTH for all tier-related mappings.
 * All other files should import from here.
 * 
 * Tier Hierarchy (lowest to highest):
 * - free
 * - starter (Parent Starter, School Starter, Teacher Starter, etc.)
 * - premium (Parent Plus, School Premium, Teacher Pro, etc.)
 * - pro (School Pro)
 * - enterprise (School Enterprise, Platform Super-Admin)
 */

// =============================================================================
// DATABASE ENUMS - Must match PostgreSQL enum values
// =============================================================================

/**
 * Database tier_name_aligned enum - The canonical tier identifiers
 * These are stored in: user_ai_tiers.tier, ai_tier_quotas.tier_name, etc.
 */
export type TierNameAligned = 
  | 'free'
  | 'trial'
  | 'parent_starter'
  | 'parent_plus'
  | 'teacher_starter'
  | 'teacher_pro'
  | 'school_starter'
  | 'school_premium'
  | 'school_pro'
  | 'school_enterprise';

/**
 * Simplified capability tier for AI features
 * Maps multiple product tiers to 4 capability levels
 */
export type CapabilityTier = 'free' | 'starter' | 'premium' | 'enterprise';

// =============================================================================
// TIER DISPLAY NAMES - What users see in the UI
// =============================================================================

/**
 * Display name mapping for UI
 * parent_starter -> "Starter", parent_plus -> "Pro", etc.
 */
export const TIER_DISPLAY_NAMES: Record<TierNameAligned, string> = {
  free: 'Free',
  trial: 'Trial',
  parent_starter: 'Starter',
  parent_plus: 'Pro',
  teacher_starter: 'Starter',
  teacher_pro: 'Pro',
  school_starter: 'Starter',
  school_premium: 'Premium',
  school_pro: 'Pro',
  school_enterprise: 'Enterprise',
};

/**
 * Get display name for a tier
 */
export function getTierDisplayName(tier: TierNameAligned | string): string {
  return TIER_DISPLAY_NAMES[tier as TierNameAligned] || tier;
}

// =============================================================================
// CAPABILITY TIER MAPPING - Product tier -> Capability tier
// =============================================================================

/**
 * Maps product-specific tiers to simplified capability tiers
 * Used for AI quotas, feature gating, etc.
 */
export const TIER_TO_CAPABILITY: Record<TierNameAligned, CapabilityTier> = {
  free: 'free',
  trial: 'starter', // Trial gets starter-level access
  parent_starter: 'starter',
  parent_plus: 'premium',
  teacher_starter: 'starter',
  teacher_pro: 'premium',
  school_starter: 'starter',
  school_premium: 'premium',
  school_pro: 'premium', // Pro maps to premium capabilities
  school_enterprise: 'enterprise',
};

/**
 * Get capability tier from product tier
 */
export function getCapabilityTier(tier: TierNameAligned | string): CapabilityTier {
  return TIER_TO_CAPABILITY[tier as TierNameAligned] || 'free';
}

// =============================================================================
// REVENUECAT MAPPING
// =============================================================================

/**
 * RevenueCat product IDs mapped to our tiers
 * These must match what's configured in RevenueCat dashboard
 */
export const REVENUECAT_PRODUCT_TO_TIER: Record<string, TierNameAligned> = {
  // Parent plans (Google Play)
  'edudash_starter_monthly': 'parent_starter',
  'edudash_starter_monthly:p1m': 'parent_starter',
  'edudash_starter_annual': 'parent_starter',
  'edudash_premium_monthly': 'parent_plus',
  'edudash_premium_monthly:p1m': 'parent_plus',
  'edudash_premium_annual': 'parent_plus',
  
  // School plans (for future)
  'edudash_school_starter_monthly': 'school_starter',
  'edudash_school_premium_monthly': 'school_premium',
  'edudash_school_pro_monthly': 'school_pro',
  'edudash_school_enterprise_monthly': 'school_enterprise',
  
  // Teacher plans (for future)
  'edudash_teacher_starter_monthly': 'teacher_starter',
  'edudash_teacher_pro_monthly': 'teacher_pro',
};

/**
 * RevenueCat entitlement IDs
 * These must be created in RevenueCat dashboard
 */
export const REVENUECAT_ENTITLEMENTS = {
  STARTER: 'starter_features',
  PREMIUM: 'premium_features',
  PRO: 'pro_features',
  ENTERPRISE: 'enterprise_features',
} as const;

/**
 * Maps capability tier to RevenueCat entitlement
 */
export const CAPABILITY_TO_ENTITLEMENT: Record<CapabilityTier, string | null> = {
  free: null,
  starter: REVENUECAT_ENTITLEMENTS.STARTER,
  premium: REVENUECAT_ENTITLEMENTS.PREMIUM,
  enterprise: REVENUECAT_ENTITLEMENTS.ENTERPRISE,
};

/**
 * Get tier from RevenueCat product ID
 */
export function getTierFromRevenueCatProduct(productId: string): TierNameAligned {
  return REVENUECAT_PRODUCT_TO_TIER[productId] || 'free';
}

// =============================================================================
// PAYFAST MAPPING (for web subscriptions)
// =============================================================================

/**
 * PayFast plan keys mapped to our tiers
 */
export const PAYFAST_PLAN_TO_TIER: Record<string, TierNameAligned> = {
  'parent-starter': 'parent_starter',
  'parent-plus': 'parent_plus',
  'parent_starter': 'parent_starter',
  'parent_plus': 'parent_plus',
  'school-starter': 'school_starter',
  'school-premium': 'school_premium',
  'school-pro': 'school_pro',
  'school-enterprise': 'school_enterprise',
  'teacher-starter': 'teacher_starter',
  'teacher-pro': 'teacher_pro',
};

// =============================================================================
// AI QUOTAS PER CAPABILITY TIER
// =============================================================================

export interface TierQuotas {
  /** Lessons that can be AI-generated per month */
  lesson_generation: number;
  /** Homework grading assists per month */
  grading_assistance: number;
  /** Homework help queries per month */
  homework_help: number;
  /** TTS/STT minutes per month */
  transcription: number;
  /** Claude/AI chat messages per month */
  claude_messages: number;
  /** API requests per minute (rate limit) */
  rpm_limit: number;
  /** Whether TTS is enabled */
  tts_enabled: boolean;
  /** Whether full agentic mode is available */
  agentic_enabled: boolean;
}

/**
 * AI quotas per capability tier
 * This is the canonical source for quota limits
 */
export const TIER_QUOTAS: Record<CapabilityTier, TierQuotas> = {
  free: {
    lesson_generation: 5,
    grading_assistance: 5,
    homework_help: 15,
    transcription: 60,
    claude_messages: 10,
    rpm_limit: 5,
    tts_enabled: false,
    agentic_enabled: false,
  },
  starter: {
    lesson_generation: 10,
    grading_assistance: 10,
    homework_help: 30,
    transcription: 120,
    claude_messages: 50,
    rpm_limit: 15,
    tts_enabled: true,
    agentic_enabled: false,
  },
  premium: {
    lesson_generation: 50,
    grading_assistance: 100,
    homework_help: 100,
    transcription: 300,
    claude_messages: 200,
    rpm_limit: 30,
    tts_enabled: true,
    agentic_enabled: false,
  },
  enterprise: {
    lesson_generation: 5000,
    grading_assistance: 10000,
    homework_help: 30000,
    transcription: 36000,
    claude_messages: 50000,
    rpm_limit: 60,
    tts_enabled: true,
    agentic_enabled: false, // Only super_admin gets full agentic, not enterprise orgs
  },
};

/**
 * Get quotas for a product tier
 */
export function getQuotasForTier(tier: TierNameAligned | string): TierQuotas {
  const capabilityTier = getCapabilityTier(tier as TierNameAligned);
  return TIER_QUOTAS[capabilityTier];
}

// =============================================================================
// PRICING (for display purposes - actual prices in PayFast/RevenueCat)
// =============================================================================

export interface TierPricing {
  monthly: number;
  annual: number;
  currency: string;
}

/**
 * Pricing per tier (in ZAR)
 * NOTE: These are display prices. Actual billing is handled by PayFast/RevenueCat
 * 
 * CURRENT PROMOTION: 50% Early Bird discount
 * - Starter: R99/month → R49.50 (Early Bird)
 * - Pro/Plus: R199/month → R99.50 (Early Bird)
 */
export const TIER_PRICING: Record<TierNameAligned, TierPricing | null> = {
  free: null,
  trial: null,
  parent_starter: { monthly: 99, annual: 950, currency: 'ZAR' },
  parent_plus: { monthly: 199, annual: 1910, currency: 'ZAR' },
  teacher_starter: { monthly: 99, annual: 950, currency: 'ZAR' },
  teacher_pro: { monthly: 199, annual: 1910, currency: 'ZAR' },
  school_starter: { monthly: 299, annual: 2990, currency: 'ZAR' },
  school_premium: { monthly: 599, annual: 5990, currency: 'ZAR' },
  school_pro: { monthly: 999, annual: 9990, currency: 'ZAR' },
  school_enterprise: null, // Contact sales
};

/**
 * Early Bird Discount Configuration
 * Active promotions for new subscribers
 * Extended through Q1 2026
 */
export const EARLY_BIRD_DISCOUNT = {
  enabled: true,
  discountPercent: 50,
  parentTiersOnly: true, // Only applies to parent_starter and parent_plus
  endDate: new Date('2026-03-31T23:59:59.999Z'),
};

/**
 * Get the discounted price for Early Bird promotion
 */
export function getEarlyBirdPrice(tier: TierNameAligned): TierPricing | null {
  if (!EARLY_BIRD_DISCOUNT.enabled) return TIER_PRICING[tier];
  if (EARLY_BIRD_DISCOUNT.parentTiersOnly && !tier.startsWith('parent_')) {
    return TIER_PRICING[tier];
  }
  
  const basePricing = TIER_PRICING[tier];
  if (!basePricing) return null;
  
  const discountMultiplier = (100 - EARLY_BIRD_DISCOUNT.discountPercent) / 100;
  return {
    monthly: basePricing.monthly * discountMultiplier,
    annual: basePricing.annual * discountMultiplier,
    currency: basePricing.currency,
  };
}

// =============================================================================
// ROLE-BASED TIER SELECTION
// =============================================================================

/**
 * Get available tiers for a user role
 */
export function getAvailableTiersForRole(role: string): TierNameAligned[] {
  switch (role) {
    case 'parent':
      return ['free', 'parent_starter', 'parent_plus'];
    case 'teacher':
    case 'private_teacher':
      return ['free', 'teacher_starter', 'teacher_pro'];
    case 'principal':
    case 'admin':
      return ['free', 'school_starter', 'school_premium', 'school_pro', 'school_enterprise'];
    case 'super_admin':
    case 'superadmin':
      return ['school_enterprise']; // Super-admin always has enterprise
    default:
      return ['free'];
  }
}

/**
 * Get the default tier for a new user of a given role
 */
export function getDefaultTierForRole(role: string): TierNameAligned {
  // Everyone starts on free
  return 'free';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a tier has access to a feature
 */
export function tierHasFeature(
  tier: TierNameAligned | string,
  feature: keyof TierQuotas
): boolean {
  const quotas = getQuotasForTier(tier);
  const value = quotas[feature];
  
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return false;
}

/**
 * Check if tier A is higher than tier B
 */
export function isTierHigher(tierA: TierNameAligned, tierB: TierNameAligned): boolean {
  const hierarchy: TierNameAligned[] = [
    'free',
    'trial',
    'parent_starter',
    'teacher_starter',
    'school_starter',
    'parent_plus',
    'teacher_pro',
    'school_premium',
    'school_pro',
    'school_enterprise',
  ];
  
  return hierarchy.indexOf(tierA) > hierarchy.indexOf(tierB);
}

/**
 * Normalize legacy tier names to canonical tier_name_aligned values
 */
export function normalizeTierName(tier: string): TierNameAligned {
  const normalized = tier.toLowerCase().replace(/-/g, '_');
  
  // Handle legacy mappings
  const legacyMap: Record<string, TierNameAligned> = {
    'starter': 'parent_starter',
    'basic': 'parent_starter',
    'premium': 'parent_plus',
    'pro': 'school_pro',
    'enterprise': 'school_enterprise',
    'parent-starter': 'parent_starter',
    'parent-plus': 'parent_plus',
  };
  
  return legacyMap[normalized] || (normalized as TierNameAligned) || 'free';
}
