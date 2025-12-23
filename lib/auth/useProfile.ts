/**
 * Profile Management Hook
 * 
 * Manages user profile state with TanStack Query
 * Complies with WARP.md multi-tenant security patterns
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  preschool_id: string | null;
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  preschool?: {
    id: string;
    name: string;
    subscription_tier?: string;
  } | null;
}

/**
 * Query key for profile data
 */
const PROFILE_QUERY_KEY = ['user-profile'] as const;

/**
 * Fetch current user's profile with preschool details
 */
async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const client = assertSupabase();
    
    // Get current user
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return null;
    }
    
    // Fetch profile with preschool details from profiles table (not deprecated users table)
    // profiles.id = auth.users.id directly
    let profile = null;
    let profileError = null;
    
    try {
      const { data, error } = await client
        .from('profiles')
        .select(`
          id,
          preschool_id,
          organization_id,
          role,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          avatar_url,
          is_active,
          created_at,
          updated_at,
          preschool:preschools!left(
            id,
            name,
            subscription_tier
          ),
          organization:organizations!left(
            id,
            plan_tier
          )
        `)
        .eq('id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        profile = data;
      } else {
        profileError = error;
      }
    } catch (fetchError) {
      profileError = fetchError;
    }
    
    if (profileError) {
      throw profileError;
    }
    
    if (profile) {
      // Resolve tier from organization or preschool with fallback
      const tier = profile.organization?.plan_tier || 
                   profile.preschool?.subscription_tier || 
                   'free';
      
      // Normalize the profile data
      const normalizedProfile = {
        ...profile,
        name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null,
        auth_user_id: profile.id, // profiles.id = auth.users.id
        preschool: profile.preschool ? {
          ...profile.preschool,
          subscription_tier: tier  // Use resolved tier
        } : null,
      };
      
      return normalizedProfile as UserProfile;
    }
    
    return null;
    
  } catch (error) {
    reportError(error instanceof Error ? error : new Error('Unknown error'), {
      context: 'fetchUserProfile',
    });
    return null;
  }
}

/**
 * Hook for managing user profile state
 */
export function useProfile() {
  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchUserProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    },
    meta: {
      description: 'User profile and preschool details',
    },
  });
  
  // Track profile loading errors for monitoring
  if (query.error) {
    track('edudash.profile.load_error', {
      error: query.error.message,
      retry_count: query.failureCount,
    });
  }
  
  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isError: query.isError,
  };
}