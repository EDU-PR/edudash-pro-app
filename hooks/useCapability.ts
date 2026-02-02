/**
 * useCapability Hook
 * 
 * Provides easy access to capability checking in React components
 * Integrates with SubscriptionContext for current tier
 */

import { useContext, useMemo } from 'react';
import { SubscriptionContext } from '@/contexts/SubscriptionContext';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import {
  hasCapability,
  getCapabilities,
  getTierInfo,
  checkCapabilities,
  type DashCapability,
  type Tier,
} from '@/lib/ai/capabilities';

export function useCapability() {
  const { tier, capabilityTier, ready } = useContext(SubscriptionContext);
  const effectiveTier = useMemo(() => {
    if (!ready) return 'free' as Tier;
    if (capabilityTier) return capabilityTier as Tier;
    return getCapabilityTier(normalizeTierName(String(tier))) as Tier;
  }, [tier, capabilityTier, ready]);

  const capabilities = useMemo(() => {
    if (!ready) return [];
    return getCapabilities(effectiveTier as Tier);
  }, [effectiveTier, ready]);

  const tierInfo = useMemo(() => {
    if (!ready) return null;
    return getTierInfo(effectiveTier as Tier);
  }, [effectiveTier, ready]);

  /**
   * Check if a single capability is available
   */
  const can = (capability: DashCapability): boolean => {
    if (!ready) return false;
    return hasCapability(effectiveTier as Tier, capability);
  };

  /**
   * Check multiple capabilities at once
   */
  const canMultiple = (caps: DashCapability[]) => {
    if (!ready) return {};
    return checkCapabilities(effectiveTier as Tier, caps);
  };

  /**
   * Check if user has any of the specified capabilities
   */
  const canAny = (caps: DashCapability[]): boolean => {
    if (!ready) return false;
    return caps.some(cap => hasCapability(effectiveTier as Tier, cap));
  };

  /**
   * Check if user has all of the specified capabilities
   */
  const canAll = (caps: DashCapability[]): boolean => {
    if (!ready) return false;
    return caps.every(cap => hasCapability(effectiveTier as Tier, cap));
  };

  return {
    // State
    tier: effectiveTier as Tier,
    tierInfo,
    capabilities,
    ready,
    
    // Methods
    can,
    canMultiple,
    canAny,
    canAll,
  };
}

/**
 * Hook specifically for checking a single capability
 * Useful for conditional rendering
 * 
 * @example
 * const canAnalyzeImages = useHasCapability('multimodal.vision');
 * if (!canAnalyzeImages) return <UpgradePrompt />;
 */
export function useHasCapability(capability: DashCapability): boolean {
  const { can } = useCapability();
  return can(capability);
}
