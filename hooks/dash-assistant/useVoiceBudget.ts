/**
 * Voice Budget
 *
 * Hook for loading, tracking, and querying the free-tier daily voice budget.
 * Paid tiers bypass the budget entirely (remainingMs = null).
 *
 * @module hooks/dash-assistant/useVoiceBudget
 * @max-lines 200
 */

import { useCallback, useEffect } from 'react';
import {
  loadVoiceBudget,
  trackVoiceUsage,
} from '@/lib/dash-ai/voiceBudget';

export function useVoiceBudget(
  isFreeTier: boolean,
  setVoiceBudgetRemainingMs: (ms: number | null) => void,
  voiceBudgetRemainingMs: number | null,
) {
  const refreshVoiceBudget = useCallback(async () => {
    if (!isFreeTier) {
      setVoiceBudgetRemainingMs(null);
      return;
    }
    const budget = await loadVoiceBudget();
    setVoiceBudgetRemainingMs(budget.remainingMs);
  }, [isFreeTier, setVoiceBudgetRemainingMs]);

  const consumeVoiceBudget = useCallback(
    async (deltaMs: number) => {
      if (!isFreeTier || deltaMs <= 0) return;
      await trackVoiceUsage(deltaMs);
      await refreshVoiceBudget();
    },
    [isFreeTier, refreshVoiceBudget],
  );

  useEffect(() => {
    refreshVoiceBudget();
  }, [refreshVoiceBudget]);

  const hasFreeVoiceBudget =
    voiceBudgetRemainingMs === null ? true : voiceBudgetRemainingMs > 0;

  const hasTTSAccess = useCallback(() => {
    if (!isFreeTier) return true;
    return hasFreeVoiceBudget;
  }, [isFreeTier, hasFreeVoiceBudget]);

  return {
    refreshVoiceBudget,
    consumeVoiceBudget,
    hasFreeVoiceBudget,
    hasTTSAccess,
  };
}
