import { useMemo } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { resolveFinancePrivacySettings } from '@/lib/finance/privacySettings';

export function useFinancePrivacyMode() {
  const { data: organization, isLoading } = useOrganization();

  const privacy = useMemo(
    () => resolveFinancePrivacySettings((organization?.settings as Record<string, unknown> | null) || null),
    [organization?.settings]
  );

  return {
    ...privacy,
    organizationId: organization?.id || null,
    loading: isLoading,
  };
}

