/**
 * RBAC System - Main Entry Point
 * 
 * Re-exports all RBAC functionality from split modules.
 * Import from '@/lib/rbac' for all RBAC needs.
 */

// Constants - Roles, Capabilities, Tier mappings
export {
  ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  TIER_CAPABILITIES,
  type Role,
  type SeatStatus,
  type PlanTier,
  type Capability,
} from './constants';

// Profile utilities - Profile creation and permission checking
export {
  type Student,
  type OrganizationMember,
  type OrganizationData,
  type DatabaseProfile,
  type EnhancedUserProfile,
  normalizeRole,
  getUserCapabilities,
  createEnhancedProfile,
  PermissionChecker,
  createPermissionChecker,
} from './profile-utils';

// Profile fetching - Main profile fetch function
export { fetchEnhancedUserProfile } from './fetch-profile';

// Audit utilities - Security context and auditing
export {
  type SecurityContext,
  auditPermissionChange,
  createSecurityContext,
  getSecureDatabase,
} from './audit';

// Legacy compatibility aliases from old types.ts (System B)
// These map the old role names to actual database roles
/** @deprecated Use Role from constants.ts instead */
export type RoleId = 'super_admin' | 'principal' | 'principal_admin' | 'teacher' | 'parent' | 'student';
