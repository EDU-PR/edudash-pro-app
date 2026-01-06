/**
 * React hook for feature flags
 * 
 * Provides a convenient way to check feature flags in components
 * with automatic context injection from auth state.
 * 
 * @module hooks/useFeatureFlag
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  isFeatureEnabled, 
  FeatureFlag, 
  getFeatureFlagConfig,
  getAllFeatureFlags,
  getFlagsByOwner 
} from '@/config/featureFlags';

/**
 * Hook to check if a feature flag is enabled
 * 
 * Automatically includes user and organization context from auth state
 * for user-specific feature rollouts.
 * 
 * @param flag - The feature flag to check
 * @returns Whether the feature is enabled for the current user
 * 
 * @example
 * function MyComponent() {
 *   const showGroupChat = useFeatureFlag('GROUP_CHAT');
 *   
 *   if (!showGroupChat) {
 *     return <ComingSoonBanner feature="Group Chat" />;
 *   }
 *   
 *   return <GroupChatFeature />;
 * }
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { user, profile } = useAuth();
  
  return useMemo(() => {
    return isFeatureEnabled(flag, {
      userId: user?.id,
      organizationId: profile?.organization_id ?? undefined,
    });
  }, [flag, user?.id, profile?.organization_id]);
}

/**
 * Hook to get multiple feature flags at once
 * 
 * More efficient than calling useFeatureFlag multiple times
 * 
 * @param flags - Array of feature flags to check
 * @returns Object with flag names as keys and boolean values
 * 
 * @example
 * function ChatFeatures() {
 *   const flags = useFeatureFlags(['GROUP_CHAT', 'TYPING_INDICATORS', 'READ_RECEIPTS']);
 *   
 *   return (
 *     <ChatInterface 
 *       showGroupChat={flags.GROUP_CHAT}
 *       showTypingIndicator={flags.TYPING_INDICATORS}
 *       showReadReceipts={flags.READ_RECEIPTS}
 *     />
 *   );
 * }
 */
export function useFeatureFlags<T extends FeatureFlag>(
  flags: T[]
): Record<T, boolean> {
  const { user, profile } = useAuth();
  
  return useMemo(() => {
    const context = {
      userId: user?.id,
      organizationId: profile?.organization_id ?? undefined,
    };
    
    return flags.reduce((acc, flag) => {
      acc[flag] = isFeatureEnabled(flag, context);
      return acc;
    }, {} as Record<T, boolean>);
  }, [flags, user?.id, profile?.organization_id]);
}

/**
 * Hook to get feature flag configuration (for admin/debug UI)
 * 
 * @param flag - The feature flag to get config for
 * @returns The feature flag configuration
 */
export function useFeatureFlagConfig(flag: FeatureFlag) {
  return useMemo(() => getFeatureFlagConfig(flag), [flag]);
}

/**
 * Hook to get all feature flags (for admin dashboard)
 * 
 * @returns All feature flags with their configurations
 */
export function useAllFeatureFlags() {
  return useMemo(() => getAllFeatureFlags(), []);
}

/**
 * Hook to get feature flags owned by a specific developer
 * 
 * Useful for showing a developer their assigned features
 * 
 * @param owner - Developer identifier (e.g., 'Dev 6')
 * @returns Array of feature flags owned by that developer
 */
export function useFeatureFlagsByOwner(owner: string) {
  return useMemo(() => getFlagsByOwner(owner), [owner]);
}

/**
 * Component wrapper for feature flags
 * 
 * Conditionally renders children based on feature flag
 * 
 * @example
 * <FeatureGate flag="GROUP_CHAT" fallback={<ComingSoon />}>
 *   <GroupChatFeature />
 * </FeatureGate>
 */
export function FeatureGate({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlag;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const isEnabled = useFeatureFlag(flag);
  return <>{isEnabled ? children : fallback}</>;
}
