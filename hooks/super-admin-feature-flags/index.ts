/** Super Admin Feature Flags — Orchestrator Hook. */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { logger } from '@/lib/logger';
import type { FeatureFlag, FeatureFlagForm } from '@/lib/screen-styles/super-admin-feature-flags.styles';
import type { ShowAlertFn, UseSuperAdminFeatureFlagsReturn } from './types';
import { DEFAULT_FORM, AVAILABLE_ROLES, ENVIRONMENTS } from './types';
import {
  fetchFlags, toggleFlagInDb, createFlagInDb, updateFlagInDb,
  deleteFlagFromDb, logAuditAction, trackFlagEvent, buildMockFlags,
} from './flagActions';
export type { UseSuperAdminFeatureFlagsReturn } from './types';

export function useSuperAdminFeatureFlags(
  showAlert: ShowAlertFn,
): UseSuperAdminFeatureFlagsReturn {
  const { profile } = useAuth();
  const profileId = profile?.id || '';
  const hasAccess = !!profile && isSuperAdmin(profile.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FeatureFlagForm>({ ...DEFAULT_FORM });

  const resetForm = useCallback(() => setFormData({ ...DEFAULT_FORM }), []);

  const closeModal = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedFlag(null);
    resetForm();
  }, [resetForm]);

  const loadFlags = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) {
      showAlert({ title: 'Access Denied', message: 'Super admin privileges required', type: 'error' });
      return;
    }
    try {
      setLoading(true);
      const result = await fetchFlags();
      if (result.error) {
        if (result.useMock) { setFeatureFlags(buildMockFlags(profileId)); return; }
        showAlert({ title: 'Error', message: 'Failed to load feature flags', type: 'error' });
        return;
      }
      setFeatureFlags(result.data || []);
    } catch (error) {
      logger.error('Failed to fetch feature flags:', error);
      showAlert({ title: 'Error', message: 'Failed to load feature flags', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [profile?.role, profileId, showAlert]);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFlags();
    setRefreshing(false);
  }, [loadFlags]);

  const toggleFeatureFlag = useCallback((flag: FeatureFlag) => {
    const newStatus = !flag.is_enabled;
    showAlert({
      title: 'Toggle Feature Flag',
      message: `Are you sure you want to ${newStatus ? 'enable' : 'disable'} ${flag.name}?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus ? 'Enable' : 'Disable',
          onPress: async () => {
            try {
              await toggleFlagInDb(flag.id, newStatus, profileId);
              setFeatureFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled: newStatus } : f));
              trackFlagEvent('superadmin_feature_flag_toggled', { flag_key: flag.key, flag_name: flag.name, new_status: newStatus });
              await logAuditAction(profileId, 'feature_flag_toggled', { flag_key: flag.key, flag_name: flag.name, old_status: flag.is_enabled, new_status: newStatus });
              showAlert({ title: 'Success', message: `${flag.name} ${newStatus ? 'enabled' : 'disabled'} successfully`, type: 'success' });
            } catch (error) {
              logger.error('Failed to toggle feature flag:', error);
              showAlert({ title: 'Error', message: 'Failed to update feature flag', type: 'error' });
            }
          },
        },
      ],
    });
  }, [profileId, showAlert]);

  const createFeatureFlag = useCallback(async () => {
    if (!formData.name || !formData.key || !formData.description) {
      showAlert({ title: 'Validation Error', message: 'Please fill in all required fields', type: 'warning' });
      return;
    }
    if (featureFlags.some(f => f.key === formData.key)) {
      showAlert({ title: 'Validation Error', message: 'A feature flag with this key already exists', type: 'warning' });
      return;
    }
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const newFlag: FeatureFlag = {
        id: Date.now().toString(), ...formData, target_schools: [],
        created_at: now, updated_at: now, created_by: profileId || 'unknown', updated_by: profileId || 'unknown',
      };
      await createFlagInDb(formData, profileId);
      setFeatureFlags(prev => [newFlag, ...prev]);
      trackFlagEvent('superadmin_feature_flag_created', { flag_key: formData.key, flag_name: formData.name, environment: formData.environment });
      await logAuditAction(profileId, 'feature_flag_created', { flag_key: formData.key, flag_name: formData.name, environment: formData.environment });
      showAlert({ title: 'Success', message: 'Feature flag created successfully', type: 'success' });
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      logger.error('Failed to create feature flag:', error);
      showAlert({ title: 'Error', message: 'Failed to create feature flag', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [formData, featureFlags, profileId, showAlert, resetForm]);

  const updateFeatureFlag = useCallback(async () => {
    if (!selectedFlag || !formData.name || !formData.key || !formData.description) {
      showAlert({ title: 'Validation Error', message: 'Please fill in all required fields', type: 'warning' });
      return;
    }
    try {
      setSaving(true);
      const updatedFlag: FeatureFlag = { ...selectedFlag, ...formData, updated_at: new Date().toISOString(), updated_by: profileId || 'unknown' };
      await updateFlagInDb(selectedFlag.id, formData, profileId);
      setFeatureFlags(prev => prev.map(f => f.id === selectedFlag.id ? updatedFlag : f));
      trackFlagEvent('superadmin_feature_flag_updated', { flag_key: formData.key, flag_name: formData.name, environment: formData.environment });
      await logAuditAction(profileId, 'feature_flag_updated', { flag_key: formData.key, flag_name: formData.name, changes: formData });
      showAlert({ title: 'Success', message: 'Feature flag updated successfully', type: 'success' });
      closeModal();
    } catch (error) {
      logger.error('Failed to update feature flag:', error);
      showAlert({ title: 'Error', message: 'Failed to update feature flag', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [selectedFlag, formData, profileId, showAlert, closeModal]);

  const deleteFeatureFlag = useCallback((flag: FeatureFlag) => {
    showAlert({
      title: 'Delete Feature Flag',
      message: `Are you sure you want to delete ${flag.name}? This action cannot be undone.`,
      type: 'error',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlagFromDb(flag.id);
              setFeatureFlags(prev => prev.filter(f => f.id !== flag.id));
              trackFlagEvent('superadmin_feature_flag_deleted', { flag_key: flag.key, flag_name: flag.name, environment: flag.environment });
              await logAuditAction(profileId, 'feature_flag_deleted', { flag_key: flag.key, flag_name: flag.name, environment: flag.environment });
              showAlert({ title: 'Success', message: 'Feature flag deleted successfully', type: 'success' });
            } catch (error) {
              logger.error('Failed to delete feature flag:', error);
              showAlert({ title: 'Error', message: 'Failed to delete feature flag', type: 'error' });
            }
          },
        },
      ],
    });
  }, [profileId, showAlert]);

  const openEditModal = useCallback((flag: FeatureFlag) => {
    setSelectedFlag(flag);
    setFormData({
      name: flag.name, key: flag.key, description: flag.description,
      is_enabled: flag.is_enabled, rollout_percentage: flag.rollout_percentage,
      target_roles: [...flag.target_roles], environment: flag.environment,
    });
    setShowEditModal(true);
  }, []);

  return {
    hasAccess, loading, refreshing, featureFlags, showCreateModal, showEditModal,
    selectedFlag, saving, formData, availableRoles: AVAILABLE_ROLES, environments: ENVIRONMENTS,
    onRefresh, toggleFeatureFlag, createFeatureFlag, updateFeatureFlag,
    deleteFeatureFlag, resetForm, openEditModal, closeModal,
    setFormData, setShowCreateModal, setShowEditModal, setSelectedFlag,
  };
}
