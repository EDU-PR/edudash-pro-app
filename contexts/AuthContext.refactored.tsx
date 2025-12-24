/**
 * Auth Context - Main Provider
 * 
 * Refactored from original 623-line file to meet WARP.md size limits (≤400 lines).
 * Session initialization and sign-out logic extracted to separate hooks.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { track } from '@/lib/analytics';
import { 
  fetchEnhancedUserProfile, 
  createPermissionChecker,
  type EnhancedUserProfile,
  type PermissionChecker
} from '@/lib/rbac';
import type { Session, User } from '@supabase/supabase-js';
import { useSessionInitialization, toEnhancedProfile } from './auth/useSessionInitialization';
import { useSignOut } from './auth/useSignOut';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: EnhancedUserProfile | null;
  permissions: PermissionChecker;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  permissions: createPermissionChecker(null),
  loading: true,
  profileLoading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<EnhancedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionChecker>(createPermissionChecker(null));

  // Actions object for child hooks
  const actions = {
    setUser,
    setSession,
    setProfile,
    setPermissions,
    setLoading,
    setProfileLoading,
  };

  // State object for child hooks
  const state = {
    user,
    session,
    profile,
    permissions,
    loading,
    profileLoading,
  };

  // Fetch enhanced user profile
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfileLoading(true);
      const enhancedProfile = await fetchEnhancedUserProfile(userId);
      setProfile(enhancedProfile);
      setPermissions(createPermissionChecker(enhancedProfile));
      
      // Track profile load
      track('edudash.auth.profile_loaded', {
        user_id: userId,
        has_profile: !!enhancedProfile,
        role: enhancedProfile?.role,
        capabilities_count: enhancedProfile?.capabilities?.length || 0,
      });
      
      return enhancedProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Refresh profile (useful when permissions change)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  // Initialize session (from extracted hook)
  useSessionInitialization(state, actions, user);

  // Handle sign out (from extracted hook)
  const handleSignOut = useSignOut(user, profile, session, actions);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      permissions,
      loading, 
      profileLoading,
      refreshProfile,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Convenience hooks for common permission checks
export function usePermissions(): PermissionChecker {
  const { permissions } = useAuth();
  return permissions;
}

export function useUserProfile(): EnhancedUserProfile | null {
  const { profile } = useAuth();
  return profile;
}

// Re-export the toEnhancedProfile utility
export { toEnhancedProfile };
