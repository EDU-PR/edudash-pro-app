import { assertSupabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { fetchEnhancedUserProfile, type EnhancedUserProfile, type Role } from '@/lib/rbac';
import type { User } from '@supabase/supabase-js';
import { getPendingTeacherInvite, clearPendingTeacherInvite } from '@/lib/utils/teacherInvitePending';
import {
  normalizeResolvedSchoolType,
  resolveSchoolTypeFromProfile,
  type ResolvedSchoolType,
} from '@/lib/schoolTypeResolver';

const debugEnabled = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;
const debugLog = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};
const debugWarn = (...args: unknown[]) => {
  if (debugEnabled) console.warn(...args);
};

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

function resolveAdminSchoolType(profile: EnhancedUserProfile): ResolvedSchoolType | null {
  const fromMembership = normalizeResolvedSchoolType((profile as any)?.organization_membership?.school_type);
  if (fromMembership) return fromMembership;

  const fromOrgKind = normalizeResolvedSchoolType((profile as any)?.organization_membership?.organization_kind);
  if (fromOrgKind) return fromOrgKind;

  const fromTenantKind = normalizeResolvedSchoolType((profile as any)?.organization_kind || (profile as any)?.tenant_kind);
  if (fromTenantKind) return fromTenantKind;

  return null;
}

async function resolveTeacherApprovalRoute(profile: EnhancedUserProfile): Promise<{ path: string; params?: Record<string, string> } | null> {
  const role = normalizeRole(profile.role);
  if (role !== 'teacher') return null;

  const teacherId = profile.id;
  const schoolId = profile.organization_id || (profile as any)?.preschool_id || null;
  if (!teacherId || !schoolId) return null;

  try {
    const { data: approval, error } = await assertSupabase()
      .from('teacher_approvals')
      .select('status')
      .eq('teacher_id', teacherId)
      .eq('preschool_id', schoolId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[ROUTE DEBUG] Teacher approval lookup failed, skipping gate:', error.message);
      return null;
    }

    if (!approval?.status || approval.status === 'approved') {
      return null;
    }

    if (approval.status === 'pending') {
      return { path: '/screens/teacher-approval-pending' };
    }

    if (approval.status === 'rejected') {
      return { path: '/screens/teacher-approval-pending', params: { state: 'rejected' } };
    }

    return null;
  } catch (lookupError) {
    console.warn('[ROUTE DEBUG] Teacher approval gate exception, skipping:', lookupError);
    return null;
  }
}

export function isNavigationLocked(userId: string): boolean {
  const lockTime = navigationLocks.get(userId);
  // #region agent log
  debugLog('[DEBUG_AGENT] NavLock-CHECK', JSON.stringify({userId,hasLock:!!lockTime,lockAge:lockTime?Date.now()-lockTime:null,lockCount:navigationLocks.size,timestamp:Date.now()}));
  // #endregion
  if (!lockTime) return false;
  // Auto-expire old locks
  if (Date.now() - lockTime > NAVIGATION_LOCK_TIMEOUT) {
    console.log('🚦 [ROUTE] Auto-expiring stale navigation lock for user:', userId);
    navigationLocks.delete(userId);
    return false;
  }
  return true;
}

function setNavigationLock(userId: string): void {
  navigationLocks.set(userId, Date.now());
  console.log('🚦 [ROUTE] Navigation lock set for user:', userId, 'at', new Date().toISOString());
}

function clearNavigationLock(userId: string): void {
  const hadLock = navigationLocks.has(userId);
  navigationLocks.delete(userId);
  if (hadLock) {
    console.log('🚦 [ROUTE] Navigation lock cleared for user:', userId);
  }
}

/**
 * Clear ALL navigation locks (used during sign-out to prevent stale locks)
 */
export function clearAllNavigationLocks(): void {
  const count = navigationLocks.size;
  // #region agent log
  debugLog('[DEBUG_AGENT] NavLock-CLEARALL', JSON.stringify({lockCount:count,locks:Array.from(navigationLocks.keys()),timestamp:Date.now()}));
  // #endregion
  navigationLocks.clear();
  if (count > 0) {
    console.log('🚦 [ROUTE] Cleared all navigation locks:', count, 'locks removed');
  }
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
 * 
 * Includes timeout protection to prevent infinite hanging
 */
export async function routeAfterLogin(user?: User | null, profile?: EnhancedUserProfile | null): Promise<void> {
  const userId = user?.id;
  // #region agent log
  debugLog('[DEBUG_AGENT] RouteAfterLogin-ENTRY', JSON.stringify({userId,hasProfile:!!profile,role:profile?.role,lockCount:navigationLocks.size,timestamp:Date.now()}));
  // #endregion
  if (!userId) {
    console.error('No user ID provided for post-login routing');
    router.replace('/(auth)/sign-in');
    return;
  }

  // Wrap entire function in timeout to prevent hanging
  const overallTimeout = setTimeout(() => {
    console.error('🚦 [ROUTE] routeAfterLogin overall timeout (15s) - forcing fallback navigation');
    // #region agent log
    debugLog('[DEBUG_AGENT] RouteAfterLogin-TIMEOUT', JSON.stringify({userId,timestamp:Date.now()}));
    // #endregion
    clearNavigationLock(userId);
    router.replace('/profiles-gate');
  }, 15000);

  try {
    // CRITICAL FIX: Clear any stale locks before checking
    // Stale locks from previous sessions can cause sign-in freeze
    const lockTime = navigationLocks.get(userId);
    if (lockTime && Date.now() - lockTime > NAVIGATION_LOCK_TIMEOUT) {
      console.log('🚦 [ROUTE] Clearing stale navigation lock for user:', userId);
      navigationLocks.delete(userId);
    }
    
    // EARLY CHECK: Prevent concurrent navigation attempts using module-level lock
    // Check at the very start to avoid duplicate work (profile fetch, etc.)
    if (isNavigationLocked(userId)) {
      console.log('🚦 [ROUTE] Navigation already in progress for user (early check), skipping');
      clearTimeout(overallTimeout);
      return;
    }
    
    // Set navigation lock early to prevent concurrent calls from proceeding
    setNavigationLock(userId);
    console.log('🚦 [ROUTE] Navigation lock acquired early for user:', userId);

    // Fetch enhanced profile if not provided or if the provided profile is not enhanced
    let enhancedProfile = profile as any;
    const needsEnhanced = !enhancedProfile || typeof enhancedProfile.hasCapability !== 'function';
    if (needsEnhanced) {
      debugLog('[ROUTE DEBUG] Fetching enhanced profile for user:', userId);
      
      // Add timeout protection to prevent infinite hanging
      const fetchPromise = fetchEnhancedUserProfile(userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 9000)
      );
      
      try {
        enhancedProfile = await Promise.race([fetchPromise, timeoutPromise]) as any;
        debugLog('[ROUTE DEBUG] fetchEnhancedUserProfile result:', enhancedProfile ? 'SUCCESS' : 'NULL');
        if (enhancedProfile) {
          debugLog('[ROUTE DEBUG] Profile role:', enhancedProfile.role);
          debugLog('[ROUTE DEBUG] Profile org_id:', enhancedProfile.organization_id);
        }
      } catch (fetchError) {
        console.error('[ROUTE DEBUG] Profile fetch failed:', fetchError);
        enhancedProfile = null;
        // CRITICAL FIX: Clear lock on profile fetch failure to prevent freeze
        clearNavigationLock(userId);
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
      clearTimeout(overallTimeout);
      router.replace('/profiles-gate');
      return;
    }

    const pendingInvite = await getPendingTeacherInvite();
    if (pendingInvite?.token && pendingInvite?.email) {
      await clearPendingTeacherInvite();
      clearNavigationLock(userId);
      clearTimeout(overallTimeout);
      router.replace(`/screens/teacher-invite-accept?token=${encodeURIComponent(pendingInvite.token)}&email=${encodeURIComponent(pendingInvite.email)}`);
      return;
    }

    // Check if user needs to change password on first login (admin-created accounts)
    const forcePasswordChange = user?.user_metadata?.force_password_change;
    if (forcePasswordChange) {
      console.log('🚦 [ROUTE] User needs to change password on first login, redirecting to change-password screen');
      track('edudash.auth.force_password_change', {
        user_id: userId,
        created_by_admin: user?.user_metadata?.created_by_admin,
      });
      clearNavigationLock(userId);
      clearTimeout(overallTimeout);
      // Route to the change password screen (we'll create this)
      router.replace('/screens/change-password-required' as any);
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
    let route = determineUserRoute(enhancedProfile);
    const teacherApprovalRoute = await resolveTeacherApprovalRoute(enhancedProfile);
    if (teacherApprovalRoute) {
      route = teacherApprovalRoute;
    }
    const resolvedSchoolType = resolveSchoolTypeFromProfile(enhancedProfile);
    const targetDashboard = route.path;
    
    // Track routing decision
    track('edudash.auth.route_after_login', {
      user_id: userId,
      role: enhancedProfile.role,
      resolved_school_type: resolvedSchoolType,
      target_dashboard: targetDashboard,
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
      
      // Clear overall timeout since navigation was initiated
      clearTimeout(overallTimeout);
    } catch (error) {
      console.error('🚦 [ROUTE] Unexpected error during navigation setup:', error);
      clearTimeout(overallTimeout);
      // Clear locks on error
      clearNavigationLock(userId);
      if (typeof window !== 'undefined') {
        delete (window as any).dashboardSwitching;
      }
      // Fallback navigation
      router.replace('/profiles-gate');
    }
  } catch (error) {
    clearTimeout(overallTimeout);
    reportError(new Error('Post-login routing failed'), {
      userId: user?.id,
      error,
    });
    
    // Clear lock on error
    if (user?.id) {
      clearNavigationLock(user.id);
    }
    
    // Fallback to safe route
    router.replace('/profiles-gate');
  }
}

/**
 * Determine the appropriate route for a user based on their enhanced profile
 */
function determineUserRoute(profile: EnhancedUserProfile): { path: string; params?: Record<string, string> } {
  let role = normalizeRole(profile.role);
  
  debugLog('[ROUTE DEBUG] ==> Determining route for user');
  debugLog('[ROUTE DEBUG] Original role:', profile.role, '-> normalized:', role);
  debugLog('[ROUTE DEBUG] Profile organization_id:', profile.organization_id);
  debugLog('[ROUTE DEBUG] Profile preschool_id:', (profile as any).preschool_id);
  debugLog('[ROUTE DEBUG] Profile seat_status:', profile.seat_status);
  debugLog('[ROUTE DEBUG] Profile capabilities:', profile.capabilities);
  debugLog('[ROUTE DEBUG] Profile hasCapability(access_mobile_app):', profile.hasCapability('access_mobile_app'));
  
  // PRIORITY CHECK #0: Check membership status - pending members go to pending screen
  // This ensures users can't access dashboards until approved by the President
  const membershipStatus = (profile as any)?.organization_membership?.membership_status 
                        || (profile as any)?.membership_status;
  const isPendingMember = membershipStatus === 'pending' || membershipStatus === 'pending_verification';
  
  debugLog('[ROUTE DEBUG] Membership status:', membershipStatus, 'isPending:', isPendingMember);
  
  // Skip pending check for executive roles who should never be blocked
  const executiveTypes = ['youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer', 
                          'ceo', 'president', 'national_admin', 'secretary_general', 'treasurer'];
  const memberType = (profile as any)?.organization_membership?.member_type;
  const isExecutive = memberType && executiveTypes.includes(memberType);
  
  if (isPendingMember && !isExecutive && role !== 'super_admin') {
    debugLog('[ROUTE DEBUG] User has pending membership - routing to membership-pending screen');
    return { path: '/screens/membership/membership-pending' };
  }
  
  // Check for organization membership (null means independent user)
  const hasOrganization = !!(profile.organization_id || (profile as any).preschool_id);
  const isIndependentUser = !hasOrganization;
  
  // Get member role for SOA routing decisions (memberType already declared above)
  const memberRole = (profile as any)?.organization_membership?.role;
  
  debugLog('[ROUTE DEBUG] Organization membership member_type:', memberType);
  debugLog('[ROUTE DEBUG] Organization membership role:', memberRole);
  debugLog('[ROUTE DEBUG] Full organization_membership object:', JSON.stringify((profile as any)?.organization_membership, null, 2));
  
  // Define SOA-specific member types that ALWAYS use member_type routing
  // These are wing-specific roles that take priority over profile.role
  // (because SOA users often have profile.role='admin' but specific member_type)
  const soaSpecificMemberTypes = [
    // Executive roles
    'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
    'national_admin', 'national_coordinator', 'executive', 'board_member',
    // Youth wing
    'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
    'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member',
    // Women's wing
    'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
    'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member',
    // Veterans league
    'veterans_president', 'veterans_coordinator', 'veterans_member',
    // Regional/Provincial
    'regional_manager', 'regional_coordinator', 'provincial_manager', 'provincial_coordinator',
    'branch_manager',
  ];
  
  // PRIORITY CHECK #1: SOA-specific member types ALWAYS route based on member_type
  // This ensures youth_president, women_president, regional_manager etc. go to correct dashboards
  // regardless of their profile.role (which might be 'admin' or 'parent')
  const hasSoaSpecificRole = memberType && soaSpecificMemberTypes.includes(memberType);
  
  // #region agent log
  debugLog('[DEBUG_AGENT] RouteDecision-SOA_CHECK', JSON.stringify({
    memberType,
    hasSoaSpecificRole,
    hasOrganization,
    isInList: memberType ? soaSpecificMemberTypes.includes(memberType) : false,
    orgId: profile.organization_id,
    timestamp: Date.now()
  }));
  // #endregion
  
  if (hasSoaSpecificRole && hasOrganization) {
    debugLog('[ROUTE DEBUG] SOA-specific member_type detected:', memberType, '- using member_type routing');
    // #region agent log
    debugLog('[DEBUG_AGENT] RouteDecision-SOA_ROUTING', JSON.stringify({
      memberType,
      orgId: profile.organization_id,
      timestamp: Date.now()
    }));
    // #endregion
    
    // CEO / National Admin / President / Executive leadership
    if (memberType === 'national_admin' || memberType === 'ceo' || memberType === 'president' ||
        memberType === 'deputy_president' || memberType === 'secretary_general' || memberType === 'treasurer') {
      debugLog('[ROUTE DEBUG] CEO/President detected via member_type - routing to CEO dashboard');
      return { path: '/screens/membership/ceo-dashboard' };
    }
    
    // National coordinators and executives
    if (memberType === 'national_coordinator' || memberType === 'executive' || memberType === 'board_member') {
      debugLog('[ROUTE DEBUG] National coordinator/executive detected - routing to CEO dashboard');
      return { path: '/screens/membership/ceo-dashboard' };
    }
    
    // Youth Wing executives
    if (memberType === 'youth_president' || memberType === 'youth_deputy') {
      debugLog('[ROUTE DEBUG] Youth wing executive detected - routing to youth president dashboard');
      return { path: '/screens/membership/youth-president-dashboard' };
    }
    if (memberType === 'youth_secretary') {
      debugLog('[ROUTE DEBUG] Youth secretary detected - routing to youth secretary dashboard');
      return { path: '/screens/membership/youth-secretary-dashboard' };
    }
    if (memberType === 'youth_treasurer') {
      debugLog('[ROUTE DEBUG] Youth treasurer detected - routing to youth president dashboard');
      return { path: '/screens/membership/youth-president-dashboard' };
    }
    
    // Youth Wing coordinators/facilitators/mentors - route to youth president dashboard (they help manage)
    if (memberType === 'youth_coordinator' || memberType === 'youth_facilitator' || memberType === 'youth_mentor') {
      debugLog('[ROUTE DEBUG] Youth wing staff detected - routing to youth president dashboard');
      return { path: '/screens/membership/youth-president-dashboard' };
    }
    
    // Regular Youth Wing members (youth_member) - route to learner dashboard
    if (memberType === 'youth_member') {
      debugLog('[ROUTE DEBUG] Youth member detected - routing to learner dashboard');
      return { path: '/screens/learner-dashboard' };
    }
    
    // Women's Wing - all members route to women's dashboard
    if (memberType?.startsWith('women_')) {
      debugLog('[ROUTE DEBUG] Women wing member detected - routing to women dashboard');
      return { path: '/screens/membership/women-dashboard' };
    }
    
    // Veterans League - all members route to veterans dashboard
    if (memberType?.startsWith('veterans_')) {
      debugLog('[ROUTE DEBUG] Veterans league member detected - routing to veterans dashboard');
      return { path: '/screens/membership/veterans-dashboard' };
    }
    
    // Regional/Provincial executives and managers
    if (memberType === 'regional_coordinator' || memberType === 'provincial_coordinator' ||
        memberType === 'regional_manager' || memberType === 'provincial_manager' ||
        memberType === 'branch_manager') {
      debugLog('[ROUTE DEBUG] Regional/Branch manager detected - routing to regional dashboard');
      return { path: '/screens/membership/dashboard' };
    }
  }
  
  // PRIORITY CHECK #2: School admin/principal roles skip member_type routing
  // This prevents school users with accidental org_member entries from going to wrong dashboards.
  // Keep SOA/org admins on member_type routing, but allow school admins to use role routing.
  const isSchoolAdminRole = role === 'admin' && !!resolveAdminSchoolType(profile);
  const schoolAdminRoles = ['super_admin', 'principal_admin', 'principal', 'teacher'];
  if ((role && schoolAdminRoles.includes(role)) || isSchoolAdminRole) {
    debugLog('[ROUTE DEBUG] School admin role detected:', role, '- using profile role routing');
    // Fall through to role-based routing below
  } else if (memberType && hasOrganization) {
    // PRIORITY CHECK #3: Generic member types for non-school-admin users
    
    // Staff and admin (generic org admin - for SOA staff without specific wing role)
    if (memberType === 'staff' || memberType === 'admin') {
      debugLog('[ROUTE DEBUG] Staff/Admin member detected - routing to CEO dashboard');
      return { path: '/screens/membership/ceo-dashboard' };
    }

    // Regular main organization members (learner, facilitator, mentor, volunteer, etc.)
    if (['learner', 'facilitator', 'mentor', 'volunteer', 'member'].includes(memberType)) {
      debugLog('[ROUTE DEBUG] Regular organization member detected - routing to learner dashboard');
      return { path: '/screens/learner-dashboard' };
    }
  }
  
  // Tenant kind detection (best-effort)
  const orgKind = (profile as any)?.organization_membership?.organization_kind
    || (profile as any)?.organization_kind
    || (profile as any)?.tenant_kind
    || 'school'; // default
  const isSkillsLike = ['skills', 'tertiary', 'org'].includes(String(orgKind).toLowerCase());
  
  if (process.env.EXPO_PUBLIC_ENABLE_CONSOLE === 'true') {
    debugLog('[ROUTE DEBUG] Has organization:', hasOrganization);
    debugLog('[ROUTE DEBUG] Is independent user:', isIndependentUser);
    debugLog('[ROUTE DEBUG] Organization kind:', orgKind);
  }
  
  // Safeguard: If role is null/undefined, route to sign-in/profile setup
  if (!role || role === null) {
    console.warn('User role is null, routing to sign-in');
    return { path: '/(auth)/sign-in' };
  }
  
  // Check if user has active access - but be permissive for users with valid roles
  // This prevents users from getting stuck due to capability system issues
  if (!profile.hasCapability('access_mobile_app')) {
    debugLog('[ROUTE DEBUG] User lacks access_mobile_app capability, but has role:', role);
    // For users with valid roles, allow dashboard access anyway
    // The capability system can be overly restrictive, especially for new users
    debugLog('[ROUTE DEBUG] Allowing dashboard access despite capability check');
  }

  // For independent users (no organization), route to standalone dashboards
  // These users can still access basic features but may see upgrade prompts
  if (isIndependentUser) {
    debugLog('[ROUTE DEBUG] Independent user detected (no organization) - routing to standalone dashboard');
    
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
  // Note: member_type routing is already handled above for SOA/skills-based orgs
  // #region agent log
  debugLog('[DEBUG_AGENT] RouteDecision-FALLBACK_TO_ROLE', JSON.stringify({
    role,
    memberType,
    hasOrganization,
    orgId: profile.organization_id,
    timestamp: Date.now()
  }));
  // #endregion
  
  switch (role) {
    case 'super_admin':
      return { path: '/screens/super-admin-dashboard' };
    
    case 'admin':
      // Regular organization admins (member_type routing already handled above)
      // WARNING: If we reach here, member_type routing failed - log for debugging
      debugWarn('[ROUTE DEBUG] Admin routing FALLBACK - member_type should have been used!', {
        memberType,
        hasOrganization,
        orgId: profile.organization_id,
        organization_membership: (profile as any)?.organization_membership,
      });
      const adaptiveAdminEnabled = process.env.EXPO_PUBLIC_ADAPTIVE_ADMIN_DASHBOARD_MOBILE_V1 !== 'false';
      const adminSchoolType = resolveAdminSchoolType(profile);
      const isSchoolAdminDashboardOrg = adminSchoolType === 'preschool' || adminSchoolType === 'k12_school';

      if (adaptiveAdminEnabled && isSchoolAdminDashboardOrg) {
        debugLog('[ROUTE DEBUG] Admin routing - using adaptive admin dashboard', {
          adminSchoolType,
          adaptiveAdminEnabled,
        });
        return {
          path: '/screens/admin-dashboard',
          params: { schoolType: adminSchoolType },
        };
      }

      debugLog('[ROUTE DEBUG] Admin routing - routing to org-admin-dashboard', {
        adaptiveAdminEnabled,
        adminSchoolType,
      });
      return { path: '/screens/org-admin-dashboard' };
    
    case 'principal_admin':
      debugLog('[ROUTE DEBUG] Principal admin routing - organization_id:', profile.organization_id);
      debugLog('[ROUTE DEBUG] Principal seat_status:', profile.seat_status);
      if (isSkillsLike) {
        return { path: '/screens/org-admin-dashboard' };
      }
      return { path: '/screens/principal-dashboard' };

    case 'teacher':
      return { path: '/screens/teacher-dashboard' };

    case 'parent':
      // Route to dashboard family from a single school-type resolver
      const resolvedParentSchoolType = resolveSchoolTypeFromProfile(profile);
      // #region agent log
      debugLog('[DEBUG_AGENT] Parent-ROUTING', JSON.stringify({
        resolvedParentSchoolType,
        organization_membership: (profile as any)?.organization_membership,
        organization_id: profile.organization_id,
        hasOrgMembership: !!(profile as any)?.organization_membership,
        allKeys: (profile as any)?.organization_membership ? Object.keys((profile as any).organization_membership) : [],
        timestamp: Date.now()
      }));
      // #endregion
      debugLog('[ROUTE DEBUG] Parent routing - resolved school type:', resolvedParentSchoolType);
      
      if (resolvedParentSchoolType === 'k12_school') {
        debugLog('[ROUTE DEBUG] K-12/Combined school detected - routing to K-12 parent dashboard');
        return {
          path: '/(k12)/parent/dashboard',
          params: { schoolType: 'k12_school', mode: 'k12' },
        };
      }
      // Default to preschool parent dashboard
      return { path: '/screens/parent-dashboard' };

    case 'student':
      const resolvedStudentSchoolType = resolveSchoolTypeFromProfile(profile);
      debugLog('[ROUTE DEBUG] Student routing - resolved school type:', resolvedStudentSchoolType);
      
      // Students with organization_id go to appropriate dashboard
      if (hasOrganization) {
        if (resolvedStudentSchoolType === 'k12_school') {
          debugLog('[ROUTE DEBUG] K-12/Combined school student detected - routing to K-12 student dashboard');
          return {
            path: '/(k12)/student/dashboard',
            params: { schoolType: 'k12_school', mode: 'k12' },
          };
        }
        // Default to learner dashboard for preschool/other types
        debugLog('[ROUTE DEBUG] Student with organization_id detected - routing to learner-dashboard');
        return { path: '/screens/learner-dashboard' };
      }
      // Standalone students (no organization) go to student-dashboard
      debugLog('[ROUTE DEBUG] Standalone student (no organization) - routing to student-dashboard');
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
  if (role && ['parent', 'teacher', 'principal_admin', 'admin', 'super_admin', 'student', 'learner'].includes(role)) {
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
    case 'admin':
      return '/screens/org-admin-dashboard';
    case 'principal_admin':
      return '/screens/principal-dashboard';
    case 'teacher':
      return '/screens/teacher-dashboard';
    case 'parent':
      return '/screens/parent-dashboard';
    case 'student':
    case 'learner':
      return '/screens/learner-dashboard';
    default:
      return '/landing';
  }
}
