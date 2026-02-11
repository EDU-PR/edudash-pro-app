/**
 * Session Manager — Type Definitions
 * 
 * Shared interfaces, constants, and storage keys used across the session module.
 */

import type { Session, User } from '@supabase/supabase-js';

// ============================================================================
// Interfaces
// ============================================================================

export interface UserSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  role?: string;
  organization_id?: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  // Keep this permissive: DB can contain additional role strings (e.g. student/learner/admin),
  // and RBAC normalization handles mapping to canonical roles where needed.
  role:
    | 'super_admin'
    | 'principal_admin'
    | 'principal'
    | 'teacher'
    | 'parent'
    | 'admin'
    | 'student'
    | 'learner'
    | 'superadmin';
  organization_id?: string;
  organization_name?: string;
  preschool_id?: string;
  preschool_name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string; // Computed field: first_name + last_name
  avatar_url?: string;
  date_of_birth?: string;
  seat_status?: 'active' | 'inactive' | 'pending' | 'revoked';
  capabilities?: string[];
  created_at?: string;
  last_login_at?: string;
  preferred_language?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

export const SESSION_STORAGE_KEY = 'edudash_session';
export const PROFILE_STORAGE_KEY = 'edudash_profile';
export const SUPABASE_STORAGE_KEY = 'edudash-auth-session';
export const LEGACY_SESSION_KEYS = ['edudash_user_session', 'edudash_user_profile'] as const;
export const ACTIVE_CHILD_KEYS = ['@edudash_active_child_id', 'edudash_active_child_id'] as const;
export const ACTIVE_ORG_KEYS = ['@active_organization'] as const;
export const REFRESH_THRESHOLD = parseInt(process.env.EXPO_PUBLIC_SESSION_REFRESH_THRESHOLD || '300000'); // 5 minutes

// Re-export Supabase types used by other session modules
export type { Session, User };
