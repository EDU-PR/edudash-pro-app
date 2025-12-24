import { assertSupabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { fetchEnhancedUserProfile, type EnhancedUserProfile, type Role } from '@/lib/rbac';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

type AsyncStorageType = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null;

// Optional AsyncStorage for bridging plan selection across auth (no-op on web)
let AsyncStorage: AsyncStorageType = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (e) { /* noop */ }

// Module-level navigation lock (works on both web and React Native)
const navigationLocks: Map<string, number> = new Map();
const NAVIGATION_LOCK_TIMEOUT = 10000; // 10 seconds max lock time

function isNavigationLocked(userId: string): boolean {
  const lockTime = navigationLocks.get(userId);
  if (!lockTime) return false;
  // Auto-expire old locks
  if (Date.now() - lockTime > NAVIGATION_LOCK_TIMEOUT) {
    navigationLocks.delete(userId);
    return false;
  }
  return true;
}

function setNavigationLock(userId: string): void {
  navigationLocks.set(userId, Date.now());
}

function clearNavigationLock(userId: string): void {
  navigationLocks.delete(userId);
}

function normalizeRole(r?: string | null): string | null {
  if (!r) return null;
  const s = String(r).trim().toLowerCase();
  
  // Map potential variants to canonical Role types
  if (s.includes('super') || s === 'superadmin') return 'super_admin';
  // Note: 'admin' role is for Skills Development/Tertiary/Other orgs (separate from principal)
  if (s === 'principal' || s.includes('principal') || s.includes('school admin')) return 'principal_admin';
  if (s.includes('teacher')) return 'teacher';
  if (s.includes('parent')) return 'parent';
  if (s.includes('student') || s.includes('learner')) return 'student';
  
  // Handle exact matches for the canonical types (including 'admin')
  if (['super_admin', 'principal_admin', 'admin', 'teacher', 'parent', 'student'].includes(s)) {
    return s;
  }
  
  console.warn('Unrecognized role:', r, '-> normalized to null');
  return null; // Default to null so we can route to sign-in/profile setup
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use fetchEnhancedUserProfile from RBAC instead
 */
export async function detectRoleAndSchool(user?: User | null): Promise<{ role: string | null; school: string | null }> {
  // Use provided user or fetch from auth
  let authUser = user;
  if (!authUser) {
    const { data: { user: fetchedUser } } = await assertSupabase().auth.getUser();
    authUser = fetchedUser;
  }
  
  const id = authUser?.id;
  const metadata = authUser?.user_metadata as { role?: string; preschool_id?: string } | undefined;
  let role: string | null = normalizeRole(metadata?.role ?? null);
  let school: string | null = metadata?.preschool_id ?? null;

  // First fallback: check profiles table by id (auth.users.id)
  if (id && (!role || school === null)) {
    try {
      const { data: udata, error: uerror } = await assertSupabase()
        .from('profiles')
        .select('role,preschool_id')
        .eq('id', id)
        .maybeSingle();
      if (!uerror && udata) {
        const profileData = udata as { role?: string; preschool_id?: string };
        role = normalizeRole(profileData.role ?? role);
        school = profileData.preschool_id ?? school;
      }
    } catch (e) {
      console.debug('Fallback #1 (profiles table) lookup failed', e);
    }
  }
  
  // Second fallback removed:
  // Some deployments used a legacy 'user_id' column in profiles. Referencing it causes 400 errors
  // on databases that never had that column. To avoid noisy logs and failed requests, we rely solely
  // on the primary key lookup above (id = auth.users.id). If you need legacy support, consider a
  // dedicated RPC that handles both shapes server-side.
  // if (id && (!role || school === null)) { ... }
  return { role, school };
}

/**
 * Enhanced post-login routing with comprehensive RBAC integration
 * Routes users to appropriate dashboard based on their role, capabilities, and organization membership
 */
export async function routeAfterLogin(user?: User | null, profile?: EnhancedUserProfile | null) {
  try {
    const userId = user?.id;
    if (!userId) {
      console.error('No user ID provided for post-login routing');
      router.replace('/(auth)/sign-in');
      return;
    }

    // EARLY CHECK: Prevent concurrent navigation attempts using module-level lock
    // Check at the very start to avoid duplicate work (profile fetch, etc.)
    if (isNavigationLocked(userId)) {
      console.log('🚦 [ROUTE] Navigation already in progress for user (early check), skipping');
      return;
    }
    
    // Set navigation lock early to prevent concurrent calls from proceeding
    setNavigationLock(userId);
    console.log('🚦 [ROUTE] Navigation lock acquired early for user:', userId);

    // Fetch enhanced profile if not provided or if the provided profile is not enhanced
    let enhancedProfile = profile as any;
    const needsEnhanced = !enhancedProfile || typeof enhancedProfile.hasCapability !== 'function';
    if (needsEnhanced) {
      console.log('[ROUTE DEBUG] Fetching enhanced profile for user:', userId);
      
      // Add timeout protection to prevent infinite hanging
      const fetchPromise = fetchEnhancedUserProfile(userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );
      
      try {
        enhancedProfile = await Promise.race([fetchPromise, timeoutPromise]) as any;
        console.log('[ROUTE DEBUG] fetchEnhancedUserProfile result:', enhancedProfile ? 'SUCCESS' : 'NULL');
        if (enhancedProfile) {
          console.log('[ROUTE DEBUG] Profile role:', enhancedProfile.role);
          console.log('[ROUTE DEBUG] Profile org_id:', enhancedProfile.organization_id);
        }
      } catch (fetchError) {
        console.error('[ROUTE DEBUG] Profile fetch failed:', fetchError);
        enhancedProfile = null;
      }
    }

    if (!enhancedProfile) {
      console.error('Failed to fetch user profile for routing - routing to profiles-gate for setup');
      track('edudash.auth.route_failed', {
        user_id: userId,
        reason: 'no_profile',
      });
      // Route to profiles-gate instead of sign-in to avoid redirect loop
      // User is authenticated but needs profile setup
      clearNavigationLock(userId);
      router.replace('/profiles-gate');
      return;
    }

    // If there is a pending plan selection (from unauthenticated plan click),
    // prioritize routing to subscription setup and auto-start checkout.
    try {
      const raw = await AsyncStorage?.getItem('pending_plan_selection');
      if (raw) {
        await AsyncStorage?.removeItem('pending_plan_selection');
        try {
          const pending = JSON.parse(raw);
          const planTier = pending?.planTier;
          const billing = pending?.billing === 'annual' ? 'annual' : 'monthly';
          if (planTier) {
            track('edudash.auth.bridge_to_checkout', {
              user_id: userId,
              plan_tier: planTier,
              billing,
            });
            clearNavigationLock(userId);
            router.replace({
              pathname: '/screens/subscription-setup' as any,
              params: { planId: String(planTier), billing, auto: '1' },
            } as any);
            return;
          }
        } catch {
          // ignore JSON parse errors
        }
      }
    } catch {
      // best-effort only
    }

    // Determine route based on enhanced profile
    const route = determineUserRoute(enhancedProfile);
    
    // Track routing decision
    track('edudash.auth.route_after_login', {
      user_id: userId,
      role: enhancedProfile.role,
      organization_id: enhancedProfile.organization_id,
      seat_status: enhancedProfile.seat_status,
      plan_tier: enhancedProfile.organization_membership?.plan_tier,
      route: route.path,
      has_params: !!route.params,
    });

    // Also set window flags for backward compatibility (web only)
    if (typeof window !== 'undefined') {
      (window as any).dashboardSwitching = true;
    }
    
    // Navigate to determined route (with params if needed)
    console.log('🚦 [ROUTE] Navigating to route:', route.path);
    
    try {
      // Use setTimeout to prevent blocking the UI thread
      setTimeout(() => {
        try {
          if (route.params) {
            console.log('🚦 [ROUTE] Using router.replace with params:', { pathname: route.path, params: route.params });
            router.replace({ pathname: route.path as any, params: route.params } as any);
          } else {
            console.log('🚦 [ROUTE] Using router.replace without params:', route.path);
            router.replace(route.path as any);
          }
          
          console.log('🚦 [ROUTE] router.replace call completed successfully');
        } catch (navigationError) {
          console.error('🚦 [ROUTE] Navigation failed, falling back to profiles-gate:', navigationError);
          // Fallback to profile gate to ensure user can access the app
          router.replace('/profiles-gate');
        } finally {
          // Clear locks after navigation
          setTimeout(() => {
            clearNavigationLock(userId);
            if (typeof window !== 'undefined') {
              delete (window as any).dashboardSwitching;
            }
            console.log('🚦 [ROUTE] Navigation lock cleared for user:', userId);
          }, 1000);
        }
      }, 50);
    } catch (error) {
      console.error('🚦 [ROUTE] Unexpected error during navigation setup:', error);
      // Clear locks on error
      clearNavigationLock(userId);
      if (typeof window !== 'undefined') {
        delete (window as any).dashboardSwitching;
      }
      throw error;
    }
  } catch (error) {
    reportError(new Error('Post-login routing failed'), {
      userId: user?.id,
      error,
    });
    
    // Clear lock on error
    if (user?.id) {
      clearNavigationLock(user.id);
    }
    
    // Fallback to safe route
    router.replace('/(auth)/sign-in');
  }
}

/**
 * Determine the appropriate route for a user based on their enhanced profile
 */
function determineUserRoute(profile: EnhancedUserProfile): { path: string; params?: Record<string, string> } {
  let role = normalizeRole(profile.role);
  
  console.log('[ROUTE DEBUG] ==> Determining route for user');
  console.log('[ROUTE DEBUG] Original role:', profile.role, '-> normalized:', role);
  console.log('[ROUTE DEBUG] Profile organization_id:', profile.organization_id);
  console.log('[ROUTE DEBUG] Profile preschool_id:', (profile as any).preschool_id);
  console.log('[ROUTE DEBUG] Profile seat_status:', profile.seat_status);
  console.log('[ROUTE DEBUG] Profile capabilities:', profile.capabilities);
  console.log('[ROUTE DEBUG] Profile hasCapability(access_mobile_app):', profile.hasCapability('access_mobile_app'));
  
  // Check for organization membership (null means independent user)
  const hasOrganization = !!(profile.organization_id || (profile as any).preschool_id);
  const isIndependentUser = !hasOrganization;
  
  // Tenant kind detection (best-effort)
  const orgKind = (profile as any)?.organization_membership?.organization_kind
    || (profile as any)?.organization_kind
    || (profile as any)?.tenant_kind
    || 'school'; // default
  const isSkillsLike = ['skills', 'tertiary', 'org'].includes(String(orgKind).toLowerCase());
  
  if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
    console.log('[ROUTE DEBUG] Has organization:', hasOrganization);
    console.log('[ROUTE DEBUG] Is independent user:', isIndependentUser);
    console.log('[ROUTE DEBUG] Organization kind:', orgKind);
  }
  
  // Safeguard: If role is null/undefined, route to sign-in/profile setup
  if (!role || role === null) {
    console.warn('User role is null, routing to sign-in');
    return { path: '/(auth)/sign-in' };
  }
  
  // Check if user has active access - but be permissive for users with valid roles
  // This prevents users from getting stuck due to capability system issues
  if (!profile.hasCapability('access_mobile_app')) {
    console.log('[ROUTE DEBUG] User lacks access_mobile_app capability, but has role:', role);
    // For users with valid roles, allow dashboard access anyway
    // The capability system can be overly restrictive, especially for new users
    console.log('[ROUTE DEBUG] Allowing dashboard access despite capability check');
  }

  // For independent users (no organization), route to standalone dashboards
  // These users can still access basic features but may see upgrade prompts
  if (isIndependentUser) {
    console.log('[ROUTE DEBUG] Independent user detected (no organization) - routing to standalone dashboard');
    
    switch (role) {
      case 'super_admin':
        return { path: '/screens/super-admin-dashboard' };
      
      case 'admin':
        // Independent organization admins should see onboarding to create organization
        return { path: '/screens/org-onboarding' };
      
      case 'principal_admin':
        // Independent principals should see onboarding to create/join organization
        return { path: '/screens/principal-dashboard', params: { standalone: 'true' } };

      case 'teacher':
        // Independent teachers can access basic features with upgrade prompts
        return { path: '/screens/teacher-dashboard', params: { standalone: 'true' } };

      case 'parent':
        // Independent parents can track their own children
        return { path: '/screens/parent-dashboard', params: { standalone: 'true' } };

      case 'student':
        // Standalone students should use learner dashboard (skills development focused)
        return { path: '/screens/learner-dashboard', params: { standalone: 'true' } };
    }
  }

  // Route based on role and tenant kind for organization members
  switch (role) {
    case 'super_admin':
      return { path: '/screens/super-admin-dashboard' };
    
    case 'admin':
      // Check if user is CEO of Soil of Africa organization
      console.log('[ROUTE DEBUG] Admin routing - checking for CEO membership');
      if (profile.organization_id) {
        // Check organization_members for CEO/national_admin member_type
        const memberType = (profile as any)?.organization_membership?.member_type;
        
        console.log('[ROUTE DEBUG] Member type:', memberType);
        
        if (memberType === 'national_admin' || memberType === 'ceo') {
          console.log('[ROUTE DEBUG] CEO/national_admin detected - routing to membership CEO dashboard');
          return { path: '/screens/membership/ceo-dashboard' };
        }
      }
      
      // Regular organization admins go to org-admin-dashboard
      console.log('[ROUTE DEBUG] Regular organization admin - routing to org-admin-dashboard');
      return { path: '/screens/org-admin-dashboard' };
    
    case 'principal_admin':
      console.log('[ROUTE DEBUG] Principal admin routing - organization_id:', profile.organization_id);
      console.log('[ROUTE DEBUG] Principal seat_status:', profile.seat_status);
      if (isSkillsLike) {
        return { path: '/screens/org-admin-dashboard' };
      }
      return { path: '/screens/principal-dashboard' };

    case 'teacher':
      return { path: '/screens/teacher-dashboard' };

    case 'parent':
      return { path: '/screens/parent-dashboard' };

    case 'student':
      // Students with organization_id (registered via program code) should always go to learner-dashboard
      // Only truly standalone students (no org) should go to student-dashboard
      if (hasOrganization) {
        console.log('[ROUTE DEBUG] Student with organization_id detected - routing to learner-dashboard');
        return { path: '/screens/learner-dashboard' };
      }
      // Standalone students (no organization) go to student-dashboard
      console.log('[ROUTE DEBUG] Standalone student (no organization) - routing to student-dashboard');
      return { path: '/screens/student-dashboard' };
  }

  // Default fallback
  return { path: '/' };
}

/**
 * Check if user has valid access to the mobile app
 */
export function validateUserAccess(profile: EnhancedUserProfile | null): {
  hasAccess: boolean;
  reason?: string;
  suggestedAction?: string;
} {
  if (!profile) {
    return {
      hasAccess: false,
      reason: 'No user profile found',
      suggestedAction: 'Complete your profile setup',
    };
  }

  // If user has a valid role, grant access regardless of capability check
  // This prevents users from getting stuck on profiles-gate
  const role = normalizeRole(profile.role) as Role;
  if (role && ['parent', 'teacher', 'principal_admin', 'admin', 'super_admin'].includes(role)) {
    console.log('[validateUserAccess] User has valid role:', role, '- granting access');
    return { hasAccess: true };
  }

  // Fallback: check capability if role is missing/invalid
  if (!profile.hasCapability('access_mobile_app')) {
    return {
      hasAccess: false,
      reason: 'Mobile app access not enabled',
      suggestedAction: 'Contact your administrator',
    };
  }

  return { hasAccess: true };
}

/**
 * Get the appropriate route path for a given role (without navigation)
 */
export function getRouteForRole(role: Role | string | null): string {
  const normalizedRole = normalizeRole(role as string);
  
  switch (normalizedRole) {
    case 'super_admin':
      return '/screens/super-admin-dashboard';
    case 'principal_admin':
      return '/screens/principal-dashboard';
    case 'teacher':
      return '/screens/teacher-dashboard';
    case 'parent':
      return '/screens/parent-dashboard';
    default:
      return '/landing';
  }
}

