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
        .select('id, name, slug, type, phone, email, status')
        .eq('id', orgId)
        .single();

      if (error) {
        console.error('Failed to fetch organization:', error);
        return null;
      }

      return data as OrganizationDetails;
    },
    enabled: !!orgId,
    staleTime: 300000, // 5 minutes
  });
}

