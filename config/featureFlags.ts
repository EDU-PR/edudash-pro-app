/**
 * Feature Flags Configuration
 * 
 * Use feature flags to enable/disable features without deploying code.
 * This allows multiple developers to merge incomplete features to main/develop
 * without breaking the app for users.
 * 
 * Usage:
 *   import { isFeatureEnabled, FeatureFlag } from '@/config/featureFlags';
 *   
 *   if (isFeatureEnabled('PARENT_WEEKLY_REPORTS')) {
 *     return <WeeklyReportCard />;
 *   }
 * 
 * @module config/featureFlags
 */

import Constants from 'expo-constants';

/**
 * All available feature flags in the application.
 * Add new flags here when starting a new feature.
 */
export type FeatureFlag =
  // Parent Features (Dev 6)
  | 'PARENT_WEEKLY_REPORTS'      // AI-generated weekly child progress reports
  | 'PARENT_DAILY_FEED'          // Real-time daily activity feed
  | 'PARENT_PUSH_PREFERENCES'    // Granular push notification settings
  
  // AI Features (Dev 2, 3)
  | 'AI_VOICE_V2'                // Improved voice chat with noise cancellation
  | 'AI_MEMORY_PERSISTENCE'      // Long-term conversation memory
  | 'AI_ROBOTICS_CURRICULUM'     // Phase 4: Robotics expert capabilities
  | 'AI_WAKE_WORD_V2'            // Improved wake word detection
  
  // Communication Features (Dev 9)
  | 'GROUP_CHAT'                 // Group messaging between teachers/parents
  | 'TYPING_INDICATORS'          // Show when someone is typing
  | 'READ_RECEIPTS'              // Message read status
  | 'VOICE_MESSAGES_V2'          // Improved voice message recording
  
  // Payment Features (Dev 8)
  | 'REVENUECAT_PAYMENTS'        // RevenueCat in-app purchases
  | 'SELF_SERVICE_SUBSCRIPTION'  // Users can cancel/modify subscription
  | 'PAYMENT_RETRY'              // Auto-retry failed payments
  
  // Membership Features (Dev 7)
  | 'SOA_PHASE_2'                // SOA regional rollout
  | 'MEMBER_ID_CARDS'            // Digital member ID card generation
  | 'WING_FINANCIALS'            // Wing-level financial reporting
  
  // School Features (Dev 4, 5)
  | 'BULK_TEACHER_IMPORT'        // CSV import for teachers
  | 'SCHOOL_ANALYTICS_V2'        // Enhanced school analytics dashboard
  | 'AI_LESSON_SUGGESTIONS'      // AI-suggested lesson plans
  
  // Web Features (Dev 10)
  | 'WEB_DASHBOARD_V2'           // Redesigned web dashboard
  | 'WEB_PWA_OFFLINE'            // PWA offline support
  | 'WEB_EXAM_PREP'              // Web exam preparation tools
  
  // Core Features (Dev 1)
  | 'PHONE_VERIFICATION'         // Phone number verification for auth
  | 'BIOMETRIC_V2'               // Improved biometric authentication
  | 'SESSION_PERSISTENCE';       // Better session persistence

/**
 * Feature flag configuration
 */
interface FeatureFlagConfig {
  /** Whether the feature is enabled */
  enabled: boolean;
  /** Developer responsible for this feature */
  owner: string;
  /** Description of the feature */
  description: string;
  /** When the flag was added (for cleanup tracking) */
  addedDate: string;
  /** Expected removal date (when feature is stable) */
  expectedStableDate?: string;
  /** Only enable for specific user IDs (for testing) */
  allowedUserIds?: string[];
  /** Only enable for specific organization IDs */
  allowedOrgIds?: string[];
  /** Minimum app version required */
  minVersion?: string;
}

/**
 * Feature flag definitions with metadata
 * 
 * Update this object when:
 * 1. Starting a new feature (add new flag with enabled: false)
 * 2. Feature is ready for testing (add allowedUserIds for testers)
 * 3. Feature is ready for production (set enabled: true)
 * 4. Feature is stable for 2+ weeks (remove the flag entirely)
 */
const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  // ============================================
  // PARENT FEATURES (Dev 6)
  // ============================================
  PARENT_WEEKLY_REPORTS: {
    enabled: false,
    owner: 'Dev 6',
    description: 'AI-generated weekly child progress reports sent to parents',
    addedDate: '2026-01-06',
    expectedStableDate: '2026-02-01',
  },
  PARENT_DAILY_FEED: {
    enabled: false,
    owner: 'Dev 6',
    description: 'Real-time daily activity feed showing child activities',
    addedDate: '2026-01-06',
  },
  PARENT_PUSH_PREFERENCES: {
    enabled: false,
    owner: 'Dev 6',
    description: 'Granular control over push notification types',
    addedDate: '2026-01-06',
  },

  // ============================================
  // AI FEATURES (Dev 2, 3)
  // ============================================
  AI_VOICE_V2: {
    enabled: false,
    owner: 'Dev 3',
    description: 'Improved voice chat with noise cancellation and better UX',
    addedDate: '2026-01-06',
  },
  AI_MEMORY_PERSISTENCE: {
    enabled: false,
    owner: 'Dev 2',
    description: 'Long-term conversation memory across sessions',
    addedDate: '2026-01-06',
  },
  AI_ROBOTICS_CURRICULUM: {
    enabled: false,
    owner: 'Dev 2',
    description: 'Phase 4: Robotics curriculum and expert capabilities',
    addedDate: '2026-01-06',
    expectedStableDate: '2026-04-01',
  },
  AI_WAKE_WORD_V2: {
    enabled: false,
    owner: 'Dev 3',
    description: 'Improved wake word detection accuracy',
    addedDate: '2026-01-06',
  },

  // ============================================
  // COMMUNICATION FEATURES (Dev 9)
  // ============================================
  GROUP_CHAT: {
    enabled: false,
    owner: 'Dev 9',
    description: 'Group messaging for teacher-parent communication',
    addedDate: '2026-01-06',
  },
  TYPING_INDICATORS: {
    enabled: false,
    owner: 'Dev 9',
    description: 'Show typing indicator in chat',
    addedDate: '2026-01-06',
  },
  READ_RECEIPTS: {
    enabled: false,
    owner: 'Dev 9',
    description: 'Show message read status',
    addedDate: '2026-01-06',
  },
  VOICE_MESSAGES_V2: {
    enabled: false,
    owner: 'Dev 9',
    description: 'Improved voice message recording and playback',
    addedDate: '2026-01-06',
  },

  // ============================================
  // PAYMENT FEATURES (Dev 8)
  // ============================================
  REVENUECAT_PAYMENTS: {
    enabled: false,
    owner: 'Dev 8',
    description: 'RevenueCat integration for in-app purchases',
    addedDate: '2026-01-06',
    expectedStableDate: '2026-03-01',
  },
  SELF_SERVICE_SUBSCRIPTION: {
    enabled: false,
    owner: 'Dev 8',
    description: 'Allow users to manage their own subscription',
    addedDate: '2026-01-06',
  },
  PAYMENT_RETRY: {
    enabled: false,
    owner: 'Dev 8',
    description: 'Automatic retry for failed payments',
    addedDate: '2026-01-06',
  },

  // ============================================
  // MEMBERSHIP FEATURES (Dev 7)
  // ============================================
  SOA_PHASE_2: {
    enabled: true, // Already in production
    owner: 'Dev 7',
    description: 'SOA regional rollout with multi-org support',
    addedDate: '2026-01-06',
  },
  MEMBER_ID_CARDS: {
    enabled: false,
    owner: 'Dev 7',
    description: 'Digital member ID card generation',
    addedDate: '2026-01-06',
  },
  WING_FINANCIALS: {
    enabled: false,
    owner: 'Dev 7',
    description: 'Wing-level financial reporting',
    addedDate: '2026-01-06',
  },

  // ============================================
  // SCHOOL FEATURES (Dev 4, 5)
  // ============================================
  BULK_TEACHER_IMPORT: {
    enabled: false,
    owner: 'Dev 4',
    description: 'CSV import for bulk adding teachers',
    addedDate: '2026-01-06',
  },
  SCHOOL_ANALYTICS_V2: {
    enabled: false,
    owner: 'Dev 4',
    description: 'Enhanced school analytics dashboard',
    addedDate: '2026-01-06',
  },
  AI_LESSON_SUGGESTIONS: {
    enabled: false,
    owner: 'Dev 5',
    description: 'AI-suggested lesson plans based on curriculum',
    addedDate: '2026-01-06',
  },

  // ============================================
  // WEB FEATURES (Dev 10)
  // ============================================
  WEB_DASHBOARD_V2: {
    enabled: false,
    owner: 'Dev 10',
    description: 'Redesigned web dashboard with new layout',
    addedDate: '2026-01-06',
  },
  WEB_PWA_OFFLINE: {
    enabled: false,
    owner: 'Dev 10',
    description: 'PWA offline support for web app',
    addedDate: '2026-01-06',
  },
  WEB_EXAM_PREP: {
    enabled: false,
    owner: 'Dev 10',
    description: 'Web-based exam preparation tools',
    addedDate: '2026-01-06',
  },

  // ============================================
  // CORE FEATURES (Dev 1)
  // ============================================
  PHONE_VERIFICATION: {
    enabled: false,
    owner: 'Dev 1',
    description: 'Phone number verification for authentication',
    addedDate: '2026-01-06',
  },
  BIOMETRIC_V2: {
    enabled: false,
    owner: 'Dev 1',
    description: 'Improved biometric authentication',
    addedDate: '2026-01-06',
  },
  SESSION_PERSISTENCE: {
    enabled: false,
    owner: 'Dev 1',
    description: 'Better session persistence across app restarts',
    addedDate: '2026-01-06',
  },
};

/**
 * Get the current app version from Expo config
 */
function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

/**
 * Check if a feature flag is enabled
 * 
 * @param flag - The feature flag to check
 * @param context - Optional context for user/org-specific flags
 * @returns Whether the feature is enabled
 * 
 * @example
 * // Simple check
 * if (isFeatureEnabled('GROUP_CHAT')) {
 *   return <GroupChatFeature />;
 * }
 * 
 * @example
 * // With user context (for beta testing)
 * if (isFeatureEnabled('AI_VOICE_V2', { userId: user.id })) {
 *   return <VoiceChatV2 />;
 * }
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  context?: {
    userId?: string;
    organizationId?: string;
  }
): boolean {
  const config = FEATURE_FLAGS[flag];
  
  if (!config) {
    console.warn(`[FeatureFlags] Unknown flag: ${flag}`);
    return false;
  }

  // Check if globally disabled
  if (!config.enabled) {
    // Check if user is in allowed list for testing
    if (context?.userId && config.allowedUserIds?.includes(context.userId)) {
      return true;
    }
    
    // Check if org is in allowed list for testing
    if (context?.organizationId && config.allowedOrgIds?.includes(context.organizationId)) {
      return true;
    }
    
    return false;
  }

  // Check minimum version requirement
  if (config.minVersion) {
    const currentVersion = getAppVersion();
    if (compareVersions(currentVersion, config.minVersion) < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Get the configuration for a feature flag
 * Useful for debugging and admin dashboards
 */
export function getFeatureFlagConfig(flag: FeatureFlag): FeatureFlagConfig | undefined {
  return FEATURE_FLAGS[flag];
}

/**
 * Get all feature flags with their current status
 * Useful for admin dashboards and debugging
 */
export function getAllFeatureFlags(): Record<FeatureFlag, FeatureFlagConfig> {
  return { ...FEATURE_FLAGS };
}

/**
 * Get all enabled feature flags
 */
export function getEnabledFlags(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    flag => FEATURE_FLAGS[flag].enabled
  );
}

/**
 * Get all disabled feature flags (in development)
 */
export function getInDevelopmentFlags(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    flag => !FEATURE_FLAGS[flag].enabled
  );
}

/**
 * Get feature flags by owner
 */
export function getFlagsByOwner(owner: string): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    flag => FEATURE_FLAGS[flag].owner === owner
  );
}
