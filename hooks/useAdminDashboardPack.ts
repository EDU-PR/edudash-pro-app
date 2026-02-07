import { useMemo } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { resolveAdminTaskPack } from '@/lib/dashboard/admin/taskPackResolver';
import type { AdminOrgTypeV1, AdminTaskPack, AdminTaskPackResolution } from '@/lib/dashboard/admin/types';

interface UseAdminDashboardPackResult {
  loading: boolean;
  orgType: AdminOrgTypeV1 | null;
  isSupportedOrgType: boolean;
  organizationName: string;
  organizationSettings: Record<string, unknown> | null;
  pack: AdminTaskPack | null;
  resolution: AdminTaskPackResolution;
}

export function useAdminDashboardPack(): UseAdminDashboardPackResult {
  const { data: organization, isLoading } = useOrganization();

  const resolution = useMemo(() => {
    return resolveAdminTaskPack({
      organizationType: organization?.type,
      settings: (organization?.settings as Record<string, unknown> | null) || null,
    });
  }, [organization?.type, organization?.settings]);

  return {
    loading: isLoading,
    orgType: resolution.orgType,
    isSupportedOrgType: resolution.supported,
    organizationName: organization?.name || 'Organization',
    organizationSettings: (organization?.settings as Record<string, unknown> | null) || null,
    pack: resolution.pack,
    resolution,
  };
}
