import { useEffect, useMemo, useState } from 'react';
import { useFinancePrivacyMode } from '@/hooks/useFinancePrivacyMode';
import { useAuth } from '@/contexts/AuthContext';

const UNLOCK_TTL_MS = 20 * 60 * 1000;
const unlockCache = new Map<string, number>();

function buildCacheKey(orgId: string | null, userId: string | null) {
  return `${orgId || 'no-org'}:${userId || 'no-user'}`;
}

function isCacheUnlocked(key: string) {
  const expiry = unlockCache.get(key) || 0;
  return expiry > Date.now();
}

export function useFinanceAccessGuard() {
  const { user, profile } = useAuth();
  const { hideFeesOnDashboards, requireAppPasswordForFees } = useFinancePrivacyMode();
  const orgId = (profile?.organization_id || profile?.preschool_id || null) as string | null;
  const userId = user?.id || null;
  const cacheKey = useMemo(() => buildCacheKey(orgId, userId), [orgId, userId]);

  const [promptVisible, setPromptVisible] = useState(false);
  const [unlocked, setUnlocked] = useState<boolean>(() => isCacheUnlocked(cacheKey));

  useEffect(() => {
    setUnlocked(isCacheUnlocked(cacheKey));
  }, [cacheKey]);

  useEffect(() => {
    if (requireAppPasswordForFees && !isCacheUnlocked(cacheKey)) {
      setPromptVisible(true);
    } else {
      setPromptVisible(false);
    }
  }, [cacheKey, requireAppPasswordForFees]);

  const markUnlocked = () => {
    unlockCache.set(cacheKey, Date.now() + UNLOCK_TTL_MS);
    setUnlocked(true);
    setPromptVisible(false);
  };

  const dismissPrompt = () => {
    setPromptVisible(false);
  };

  return {
    hideFeesOnDashboards,
    requireAppPasswordForFees,
    unlocked,
    promptVisible,
    needsPassword: requireAppPasswordForFees && !unlocked,
    markUnlocked,
    dismissPrompt,
    showPrompt: () => setPromptVisible(true),
  };
}

