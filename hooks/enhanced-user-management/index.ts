/**
 * useEnhancedUserManagement — orchestrator hook
 *
 * Composes fetch, operations, filtering, and UI state for the
 * Enhanced User Management screen. ≤200 lines per WARP rules.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAlertModal } from '@/components/ui/AlertModal';
import { isSuperAdmin } from '@/lib/roleUtils';
import { logger } from '@/lib/logger';

import {
  EnhancedUser,
  UserFilter,
  UserSuspensionOptions,
  UserDeletionRequest,
  BulkOperation,
  DEFAULT_FILTERS,
  DEFAULT_SUSPENSION_OPTIONS,
} from './types';
import { applyUserFilters } from './helpers';
import {
  fetchEnhancedUsers,
  executeSuspendUser,
  executeUserDeletion,
  executeBulkOperation,
} from './userOperations';

const TAG = 'EnhancedUserManagement';

export function useEnhancedUserManagement() {
  const { profile } = useAuth();
  const { showAlert, alertProps } = useAlertModal();

  // ── State ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<EnhancedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [showBulkOperationsModal, setShowBulkOperationsModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EnhancedUser | null>(null);

  // Form state
  const [filters, setFilters] = useState<UserFilter>(DEFAULT_FILTERS);
  const [deletionRequest, setDeletionRequest] = useState<
    Partial<UserDeletionRequest>
  >({ deletionType: 'soft', reason: '' });
  const [suspensionOptions, setSuspensionOptions] =
    useState<UserSuspensionOptions>(DEFAULT_SUSPENSION_OPTIONS);

  const hasPermission = isSuperAdmin(profile?.role);

  // ── Derived ────────────────────────────────────────────────────────
  const filteredUsers = useMemo(
    () => applyUserFilters(users, filters),
    [users, filters]
  );

  // ── Fetch ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!hasPermission) return;
    try {
      setLoading(true);
      const result = await fetchEnhancedUsers(profile?.id);
      setUsers(result);
    } catch (error) {
      logger.error(TAG, 'Failed to fetch users:', error);
      showAlert({ title: 'Error', message: 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hasPermission, profile?.id, showAlert]);

  // ── Operations ─────────────────────────────────────────────────────
  const handleSuspendUser = useCallback(
    async (user: EnhancedUser, options: UserSuspensionOptions) => {
      try {
        await executeSuspendUser(user, profile?.id, options);
        showAlert({
          title: 'Success',
          message: `User ${user.email} has been suspended`,
          type: 'success',
        });
        await fetchUsers();
      } catch (error) {
        logger.error(TAG, 'Failed to suspend user:', error);
        showAlert({ title: 'Error', message: 'Failed to suspend user', type: 'error' });
      }
    },
    [profile?.id, fetchUsers, showAlert]
  );

  const handleDeleteUser = useCallback(
    (user: EnhancedUser, request: UserDeletionRequest) => {
      const isHard = request.deletionType === 'hard';
      showAlert({
        title: 'Confirm User Deletion',
        message: [
          isHard ? 'WARNING: This action CANNOT BE UNDONE.\n' : '',
          `User: ${user.email}`,
          `Type: ${request.deletionType.toUpperCase()}`,
          `Reason: ${request.reason}`,
          '',
          isHard
            ? 'All user data will be permanently deleted.'
            : 'User will be deactivated and data retained for 30 days.',
        ].join('\n'),
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' as const },
          {
            text: 'Delete',
            style: 'destructive' as const,
            onPress: async () => {
              try {
                await executeUserDeletion(user, request, profile?.id);
                showAlert({
                  title: 'Deletion Initiated',
                  message: `User ${user.email} deletion has been initiated.`,
                  type: 'success',
                });
                await fetchUsers();
              } catch (error) {
                logger.error(TAG, 'Failed to delete user:', error);
                showAlert({
                  title: 'Error',
                  message: 'Failed to delete user',
                  type: 'error',
                });
              }
            },
          },
        ],
      });
    },
    [profile?.id, fetchUsers, showAlert]
  );

  const handleBulkOperation = useCallback(
    async (operation: BulkOperation) => {
      if (operation.userIds.length === 0) {
        showAlert({
          title: 'No Users Selected',
          message: 'Please select users to perform bulk operation',
          type: 'warning',
        });
        return;
      }
      try {
        await executeBulkOperation(operation, profile?.id);
        showAlert({
          title: 'Bulk Operation Started',
          message: `${operation.operation} operation started for ${operation.userIds.length} users`,
          type: 'success',
        });
        setSelectedUsers(new Set());
        await fetchUsers();
      } catch (error) {
        logger.error(TAG, 'Failed to perform bulk operation:', error);
        showAlert({
          title: 'Error',
          message: 'Failed to perform bulk operation',
          type: 'error',
        });
      }
    },
    [profile?.id, fetchUsers, showAlert]
  );

  // ── Selection ──────────────────────────────────────────────────────
  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  }, [filteredUsers]);

  const clearSelection = useCallback(() => setSelectedUsers(new Set()), []);

  // ── Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasPermission) fetchUsers();
  }, [fetchUsers, hasPermission]);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    users,
    filteredUsers,
    selectedUsers,
    loading,
    refreshing,
    filters,
    setFilters,
    selectedUser,
    setSelectedUser,
    showUserDetailsModal,
    setShowUserDetailsModal,
    showBulkOperationsModal,
    setShowBulkOperationsModal,
    showDeletionModal,
    setShowDeletionModal,
    showSuspensionModal,
    setShowSuspensionModal,
    deletionRequest,
    setDeletionRequest,
    suspensionOptions,
    setSuspensionOptions,
    handleSuspendUser,
    handleDeleteUser,
    handleBulkOperation,
    toggleUserSelection,
    selectAllVisible,
    clearSelection,
    fetchUsers,
    hasPermission,
    alertProps,
    showAlert,
  };
}

// Re-export types & helpers for convenience
export type {
  EnhancedUser,
  UserFilter,
  UserSuspensionOptions,
  UserDeletionRequest,
  BulkOperation,
} from './types';
export { getRoleColor, getRiskColor, formatLastActivity } from './helpers';
