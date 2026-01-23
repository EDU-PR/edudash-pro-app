/**
 * RBAC Audit and Security Utilities
 * 
 * Functions for auditing permission changes and creating security contexts.
 */

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { log } from '@/lib/debug';

import { Role } from './constants';
import { EnhancedUserProfile, normalizeRole } from './profile-utils';

/**
 * Audit permission changes
 */
export async function auditPermissionChange(
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    track('edudash.rbac.permission_change', {
      user_id: userId,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
    
    log('Permission audit:', { userId, action, details });
  } catch (error) {
    reportError(new Error('Failed to audit permission change'), {
      userId,
      action,
      details,
      error,
    });
  }
}

/**
 * Security context for integration with security utilities
 */
export interface SecurityContext {
  userId: string;
  role: Role;
  organizationId?: string;
  capabilities: string[];
  seatStatus?: string;
}

/**
 * Create SecurityContext from EnhancedUserProfile
 */
export function createSecurityContext(profile: EnhancedUserProfile | null): SecurityContext | null {
  if (!profile) return null;
  
  return {
    userId: profile.id,
    role: normalizeRole(profile.role) as Role,
    organizationId: profile.organization_id,
    capabilities: profile.capabilities,
    seatStatus: profile.seat_status,
  };
}

/**
 * Get secure database instance for user profile
 */
export function getSecureDatabase(profile: EnhancedUserProfile | null) {
  const context = createSecurityContext(profile);
  if (!context) {
    throw new Error('Cannot create secure database without valid user profile');
  }
  
  // Import dynamically to avoid circular dependencies
  const { createSecureDatabase } = require('@/lib/security');
  return createSecureDatabase(context);
}
