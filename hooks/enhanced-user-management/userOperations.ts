/**
 * User operations — Supabase RPC calls + analytics tracking
 *
 * Each function performs a single concern and throws on error.
 * The orchestrating hook handles error display and UI feedback.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import {
  EnhancedUser,
  UserDeletionRequest,
  UserSuspensionOptions,
  BulkOperation,
} from './types';

// ── Data Mapping ───────────────────────────────────────────────────────

export function mapRawUser(user: any): EnhancedUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName:
      user.full_name ||
      `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
      user.email,
    role: user.role,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
    isActive: user.is_active !== false,
    isSuspended: user.is_suspended === true,
    suspensionReason: user.suspension_reason,
    suspensionExpiresAt: user.suspension_expires_at,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    profileCompleteness: user.profile_completeness || 0,
    riskScore: user.risk_score || 0,
    tags: user.tags || [],
    metadata: user.metadata || {},
  };
}

// ── Fetch ──────────────────────────────────────────────────────────────

export async function fetchEnhancedUsers(
  adminId?: string
): Promise<EnhancedUser[]> {
  const { data, error } = await assertSupabase().rpc(
    'superadmin_get_enhanced_users',
    {
      include_metadata: true,
      include_risk_scores: true,
      include_activity_data: true,
    }
  );

  if (error) throw error;

  const users = (data || []).map(mapRawUser);

  track('superadmin.users.fetched', {
    admin_id: adminId,
    total_users: users.length,
    active_users: users.filter(u => u.isActive).length,
    suspended_users: users.filter(u => u.isSuspended).length,
  });

  return users;
}

// ── Suspend ────────────────────────────────────────────────────────────

export async function executeSuspendUser(
  user: EnhancedUser,
  adminId: string | undefined,
  options: UserSuspensionOptions
): Promise<void> {
  const expiresAt =
    options.autoExpiry && options.duration
      ? new Date(
          Date.now() + options.duration * 60 * 60 * 1000
        ).toISOString()
      : null;

  const { error } = await assertSupabase().rpc('superadmin_suspend_user', {
    target_user_id: user.id,
    admin_user_id: adminId,
    suspension_reason: options.reason,
    expires_at: expiresAt,
    restrict_login: options.restrictLogin,
    restrict_data_access: options.restrictDataAccess,
    notify_user: options.notifyUser,
    escalation_level: options.escalationLevel,
  });

  if (error) throw error;

  track('superadmin.user.suspended', {
    admin_id: adminId,
    target_user_id: user.id,
    reason: options.reason,
    duration_hours: options.duration,
    auto_expiry: options.autoExpiry,
  });
}

// ── Delete ─────────────────────────────────────────────────────────────

export async function executeUserDeletion(
  user: EnhancedUser,
  request: UserDeletionRequest,
  adminId: string | undefined
): Promise<void> {
  const { error } = await assertSupabase().rpc('superadmin_delete_user', {
    target_user_id: user.id,
    admin_user_id: adminId,
    deletion_type: request.deletionType,
    deletion_reason: request.reason,
    retention_period_days: request.retentionPeriod || 30,
  });

  if (error) throw error;

  track('superadmin.user.deleted', {
    admin_id: adminId,
    target_user_id: user.id,
    deletion_type: request.deletionType,
    reason: request.reason,
  });
}

// ── Bulk Operation ─────────────────────────────────────────────────────

export async function executeBulkOperation(
  operation: BulkOperation,
  adminId: string | undefined
): Promise<void> {
  const { error } = await assertSupabase().rpc(
    'superadmin_bulk_user_operation',
    {
      admin_user_id: adminId,
      operation_type: operation.operation,
      target_user_ids: operation.userIds,
      operation_parameters: operation.parameters,
      operation_reason: operation.reason,
    }
  );

  if (error) throw error;

  track('superadmin.bulk_operation', {
    admin_id: adminId,
    operation: operation.operation,
    user_count: operation.userIds.length,
    reason: operation.reason,
  });
}
