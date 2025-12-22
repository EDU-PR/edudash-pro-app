/**
 * Organization Settings Hooks
 * 
 * Custom hooks for managing organization settings including:
 * - Branding (logo, colors, social media)
 * - AI preferences
 * - General settings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface OrganizationSettings {
  id: string;
  name: string;
  slug: string | null;
  type: string;
  logo_url?: string | null;
  brand_colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  } | null;
  social_media?: {
    website?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  } | null;
  settings?: {
    notifications?: any;
    features?: any;
    preferences?: any;
  } | null;
  ai_preferences?: {
    enabled_services?: string[];
    automation_enabled?: boolean;
    auto_generate_content?: boolean;
    preferred_model?: string;
  } | null;
}

export function useOrgSettings() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  return useQuery({
    queryKey: ['org-settings', orgId],
    queryFn: async (): Promise<OrganizationSettings | null> => {
      if (!orgId) return null;

      const { data, error } = await assertSupabase()
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) {
        console.error('Failed to fetch organization settings:', error);
        throw error;
      }

      return data as OrganizationSettings;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  return useMutation({
    mutationFn: async (updates: Partial<OrganizationSettings>) => {
      if (!orgId) throw new Error('No organization ID available');

      const { data, error } = await assertSupabase()
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
    },
  });
}






