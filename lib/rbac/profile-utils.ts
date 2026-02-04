/**
 * RBAC Profile Utilities
 * 
 * Functions and classes for creating and managing enhanced user profiles
 * with permission checking capabilities.
 */

import type { UserProfile } from '@/lib/sessionManager';
import { 
  ROLES, 
  Role, 
  Capability, 
  PlanTier, 
  SeatStatus,
  ROLE_CAPABILITIES,
  TIER_CAPABILITIES
} from './constants';

/**
 * Student record type with parent and guardian support
 */
export interface Student {
  id: string;
  created_at: string;
  updated_at: string;
  preschool_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  parent_id?: string;
  guardian_id?: string;
  parent_email?: string;
  class_id?: string;
  is_active: boolean;
}

/**
 * Organization member data structure from database
 */
export interface OrganizationMember {
  organization_id: string;
  organization_name?: string;
  plan_tier?: PlanTier;
  seat_status?: SeatStatus;
  invited_by?: string;
  created_at?: string;
  member_type?: string;
}

/**
 * Organization data structure from database
 */
export interface OrganizationData {
  id: string;
  name: string;
  subscription_tier?: PlanTier;
  plan_tier?: PlanTier;
  school_type?: string;
}

/**
 * Profile data structure from database query
 */
export interface DatabaseProfile {
  id: string;
  auth_user_id?: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
  last_login_at?: string;
  preferred_language?: string | null;
  preschool_id?: string;
  organization_id?: string;
  tenant_slug?: string;
}

/**
 * Enhanced user profile with complete RBAC information
 */
export interface EnhancedUserProfile extends UserProfile {
  organization_membership?: {
    organization_id: string;
    organization_name: string;
    plan_tier: PlanTier;
    seat_status: SeatStatus;
    invited_by?: string;
    joined_at: string;
    member_type?: string;
    school_type?: string;
  };
  capabilities: Capability[];
  hasCapability: (capability: Capability) => boolean;
  hasRole: (role: Role) => boolean;
  hasRoleOrHigher: (role: Role) => boolean;
  isOrgMember: (orgId: string) => boolean;
  hasActiveSeat: () => boolean;
}

/**
 * Normalize role strings to canonical format
 */
export function normalizeRole(role: string): Role | null {
  const normalized = role?.toLowerCase().trim();
  
  if (!normalized) return null;
  
  if (normalized.includes('super') || normalized === 'superadmin') {
    return 'super_admin';
  }
  if (normalized.includes('principal') || normalized === 'admin') {
    return 'principal_admin';
  }
  if (normalized.includes('teacher') || 
      normalized.includes('instructor') || 
      normalized.includes('facilitator') ||
      normalized.includes('trainer') ||
      normalized.includes('coach')) {
    return 'teacher';
  }
  if (normalized.includes('parent') || 
      normalized.includes('guardian') ||
      normalized.includes('sponsor')) {
    return 'parent';
  }
  if (normalized.includes('student') || normalized.includes('learner')) {
    return 'student';
  }
  
  return null;
}

/**
 * Get comprehensive user capabilities based on role, organization, and subscription
 */
export async function getUserCapabilities(
  role: string,
  planTier?: string,
  seatStatus?: string
): Promise<Capability[]> {
  const normalizedRole = (normalizeRole(role) || 'parent') as Role;
  const capabilities = new Set<Capability>();
  
  // Add role-based capabilities
  if (normalizedRole && ROLE_CAPABILITIES[normalizedRole]) {
    ROLE_CAPABILITIES[normalizedRole].forEach(cap => capabilities.add(cap));
  }

  // Determine if seat is effectively active
  const seatActive = typeof seatStatus === 'string' && 
    ['active','approved','assigned','enabled','granted'].includes(String(seatStatus).toLowerCase());

  // If teacher without an active seat, remove core teaching capabilities
  if (normalizedRole === 'teacher' && !seatActive) {
    ['manage_classes','create_assignments','grade_assignments','view_class_analytics'].forEach((cap) => {
      capabilities.delete(cap as Capability);
    });
  }
  
  // Add tier-based capabilities (only if seat is active)
  if (planTier && seatActive) {
    const tier = planTier as PlanTier;
    if (TIER_CAPABILITIES[tier]) {
      TIER_CAPABILITIES[tier].forEach(cap => capabilities.add(cap));
    }
  }
  
  return Array.from(capabilities);
}

/**
 * Create enhanced user profile with permission checking methods
 */
export function createEnhancedProfile(
  baseProfile: UserProfile,
  orgMembership?: any
): EnhancedUserProfile {
  const profile = baseProfile as EnhancedUserProfile;
  
  // Add organization membership details
  if (orgMembership) {
    profile.organization_membership = {
      organization_id: orgMembership.organization_id,
      organization_name: orgMembership.organization_name,
      plan_tier: orgMembership.plan_tier || 'free',
      seat_status: orgMembership.seat_status || 'inactive',
      invited_by: orgMembership.invited_by,
      joined_at: orgMembership.created_at,
      member_type: orgMembership.member_type,
      school_type: orgMembership.school_type,
    };
  }
  
  // Add permission checking methods
  profile.hasCapability = (capability: Capability): boolean => {
    return profile.capabilities?.includes(capability) || false;
  };
  
  profile.hasRole = (role: Role): boolean => {
    return normalizeRole(profile.role) === role;
  };
  
  profile.hasRoleOrHigher = (role: Role): boolean => {
    const userRole = normalizeRole(profile.role);
    if (!userRole) return false;
    return ROLES[userRole].level >= ROLES[role].level;
  };
  
  profile.isOrgMember = (orgId: string): boolean => {
    return profile.organization_membership?.organization_id === orgId;
  };
  
  profile.hasActiveSeat = (): boolean => {
    return profile.organization_membership?.seat_status === 'active' || 
           profile.seat_status === 'active';
  };
  
  return profile;
}

/**
 * Permission checking utilities for UI components
 */
export class PermissionChecker {
  private profile: EnhancedUserProfile | null;

  constructor(profile: EnhancedUserProfile | null) {
    this.profile = profile;
  }

  /**
   * Check if user has a specific capability
   */
  can(capability: Capability): boolean {
    return this.profile?.hasCapability(capability) || false;
  }

  /**
   * Check if user has any of the specified capabilities
   */
  canAny(capabilities: Capability[]): boolean {
    return capabilities.some(cap => this.can(cap));
  }

  /**
   * Check if user has all of the specified capabilities
   */
  canAll(capabilities: Capability[]): boolean {
    return capabilities.every(cap => this.can(cap));
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: Role): boolean {
    return this.profile?.hasRole(role) || false;
  }

  /**
   * Check if user has a role at or above the specified level
   */
  hasRoleOrHigher(role: Role): boolean {
    return this.profile?.hasRoleOrHigher(role) || false;
  }

  /**
   * Check if user is member of specific organization
   */
  isMemberOf(orgId: string): boolean {
    return this.profile?.isOrgMember(orgId) || false;
  }

  /**
   * Check if user has active seat in their organization
   */
  hasActiveSeat(): boolean {
    if (!this.profile) return false;
    return this.profile.organization_membership?.seat_status === 'active' || 
           (this.profile as any).seat_status === 'active';
  }

  /**
   * Get user's plan tier
   */
  getPlanTier(): PlanTier | null {
    return this.profile?.organization_membership?.plan_tier || null;
  }

  /**
   * Check if user's organization has specific plan tier or higher
   */
  hasPlanTier(tier: PlanTier): boolean {
    const userTier = this.getPlanTier();
    if (!userTier) return false;
    
    const tiers: PlanTier[] = ['free', 'starter', 'premium', 'enterprise'];
    const userTierIndex = tiers.indexOf(userTier);
    const requiredTierIndex = tiers.indexOf(tier);
    
    return userTierIndex >= requiredTierIndex;
  }

  /**
   * Get the enhanced profile
   */
  get enhancedProfile(): EnhancedUserProfile | null {
    return this.profile;
  }
}

/**
 * Create permission checker instance
 */
export function createPermissionChecker(profile: EnhancedUserProfile | null): PermissionChecker {
  return new PermissionChecker(profile);
}
