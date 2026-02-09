import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface OrganizationDetails {
  id: string;
  name: string;
  slug: string | null;
  type: string;
  phone: string | null;
  email: string | null;
  status: string;
  settings?: Record<string, unknown> | null;
}

export function useOrganization() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async (): Promise<OrganizationDetails | null> => {
      if (!orgId) return null;

      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, type, phone, email, status, settings')
        .eq('id', orgId)
        .maybeSingle();

      if (!error && data) {
        return data as OrganizationDetails;
      }

      // Backward compatibility: some school tenants still exist only in preschools.
      const { data: preschool, error: preschoolError } = await supabase
        .from('preschools')
        .select('id, name, settings, is_active')
        .eq('id', orgId)
        .maybeSingle();

      if (preschoolError && preschoolError.code !== 'PGRST116') {
        console.error('Failed to fetch organization from preschools fallback:', preschoolError);
      }

      if (preschool) {
        return {
          id: String((preschool as any).id),
          name: String((preschool as any).name || 'Preschool'),
          slug: null,
          type: 'preschool',
          phone: null,
          email: null,
          status: (preschool as any).is_active === false ? 'inactive' : 'active',
          settings: ((preschool as any).settings as Record<string, unknown> | null) || null,
        };
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch organization:', error);
      }

      return null;
    },
    enabled: !!orgId,
    staleTime: 300000, // 5 minutes
  });
}
