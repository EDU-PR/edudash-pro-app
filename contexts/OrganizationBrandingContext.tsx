/**
 * Organization Branding Context
 * Provides organization-level branding like wallpaper, greeting, colors
 * across all member dashboards and screens
 */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface DashboardSettings {
  wallpaper_url?: string;
  wallpaper_opacity?: number;
  custom_greeting?: string;
  primary_color?: string;
  logo_url?: string;
}

interface OrganizationBrandingContextType {
  settings: DashboardSettings | null;
  isLoading: boolean;
  error: string | null;
  organizationId: string | null;
  organizationName: string | null;
  refetch: () => Promise<void>;
}

const OrganizationBrandingContext = createContext<OrganizationBrandingContextType | null>(null);

export const useOrganizationBranding = () => {
  const context = useContext(OrganizationBrandingContext);
  if (!context) {
    // Return safe defaults if not in provider
    return {
      settings: null,
      isLoading: false,
      error: null,
      organizationId: null,
      organizationName: null,
      refetch: async () => {},
    };
  }
  return context;
};

interface OrganizationBrandingProviderProps {
  children: ReactNode;
}

export const OrganizationBrandingProvider: React.FC<OrganizationBrandingProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('[Branding] User:', user?.id);
      
      if (!user) {
        console.log('[Branding] No user found, skipping fetch');
        setIsLoading(false);
        return;
      }

      // Get user's organization membership
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name, dashboard_settings)')
        .eq('user_id', user.id)
        .single();

      console.log('[Branding] Member query result:', { member, memberError });

      if (memberError) {
        // User might not be in an organization
        console.log('[Branding] User not in organization:', memberError.message);
        logger.info('[Branding] User not in organization:', memberError.message);
        setIsLoading(false);
        return;
      }

      if (member?.organization_id && member.organizations) {
        const org = member.organizations as any;
        console.log('[Branding] Organization found:', org.id, org.name);
        console.log('[Branding] Dashboard settings:', org.dashboard_settings);
        setOrganizationId(org.id);
        setOrganizationName(org.name);
        
        if (org.dashboard_settings) {
          setSettings(org.dashboard_settings as DashboardSettings);
          console.log('[Branding] Settings applied:', org.dashboard_settings);
          logger.info('[Branding] Loaded organization branding:', org.dashboard_settings);
        } else {
          console.log('[Branding] No dashboard_settings found in organization');
        }
      } else {
        console.log('[Branding] No organization found for member');
      }
    } catch (err: any) {
      logger.error('[Branding] Error fetching branding:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();

    // Subscribe to organization changes
    const supabase = assertSupabase();
    const channel = supabase
      .channel('org-branding-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
        },
        (payload) => {
          if (payload.new?.id === organizationId && payload.new?.dashboard_settings) {
            logger.info('[Branding] Organization branding updated via realtime');
            setSettings(payload.new.dashboard_settings as DashboardSettings);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchBranding, organizationId]);

  return (
    <OrganizationBrandingContext.Provider
      value={{
        settings,
        isLoading,
        error,
        organizationId,
        organizationName,
        refetch: fetchBranding,
      }}
    >
      {children}
    </OrganizationBrandingContext.Provider>
  );
};
