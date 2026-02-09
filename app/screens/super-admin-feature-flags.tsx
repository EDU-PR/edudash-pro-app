import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Switch, Modal, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { createStyles, getEnvironmentColor } from '@/lib/screen-styles/super-admin-feature-flags.styles';
import { useSuperAdminFeatureFlags } from '@/hooks/useSuperAdminFeatureFlags';

export default function SuperAdminFeatureFlagsScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { showAlert, alertProps } = useAlertModal();

  const {
    hasAccess, loading, refreshing, featureFlags, showCreateModal, showEditModal,
    saving, formData, availableRoles, environments,
    onRefresh, toggleFeatureFlag, createFeatureFlag, updateFeatureFlag,
    deleteFeatureFlag, resetForm, openEditModal, closeModal,
    setFormData, setShowCreateModal,
  } = useSuperAdminFeatureFlags(showAlert);

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Feature Flags', headerShown: false }} />
        <ThemedStatusBar />
        <SafeAreaView style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Access Denied - Super Admin Only</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Feature Flags', headerShown: false }} />
      <ThemedStatusBar />
      
      {/* Header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Feature Flags</Text>
          <TouchableOpacity 
            onPress={() => {
              resetForm();
              setShowCreateModal(true);
            }} 
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>
            {featureFlags.length} feature flags • {featureFlags.filter(f => f.is_enabled).length} enabled
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading feature flags...</Text>
          </View>
        ) : (
          <>
            {featureFlags.map((flag) => (
              <View key={flag.id} style={styles.flagCard}>
                <View style={styles.flagHeader}>
                  <View style={styles.flagInfo}>
                    <Text style={styles.flagName}>{flag.name}</Text>
                    <Text style={styles.flagKey}>{flag.key}</Text>
                    <Text style={styles.flagDescription}>{flag.description}</Text>
                  </View>
                  
                  <View style={styles.flagControls}>
                    <Switch
                      value={flag.is_enabled}
                      onValueChange={() => toggleFeatureFlag(flag)}
                      trackColor={{ false: theme.border, true: theme.primary + '40' }}
                      thumbColor={flag.is_enabled ? theme.primary : theme.textTertiary}
                    />
                  </View>
                </View>

                <View style={styles.flagMeta}>
                  <View style={styles.flagBadges}>
                    <View style={[styles.environmentBadge, { backgroundColor: getEnvironmentColor(flag.environment) + '20', borderColor: getEnvironmentColor(flag.environment) }]}>
                      <Text style={[styles.environmentText, { color: getEnvironmentColor(flag.environment) }]}>
                        {flag.environment.toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={styles.rolloutBadge}>
                      <Text style={styles.rolloutText}>{flag.rollout_percentage}% rollout</Text>
                    </View>
                  </View>

                  <View style={styles.flagActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openEditModal(flag)}
                    >
                      <Ionicons name="create" size={16} color={theme.primary} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => deleteFeatureFlag(flag)}
                    >
                      <Ionicons name="trash" size={16} color={theme.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {flag.target_roles.length > 0 && (
                  <View style={styles.targetRoles}>
                    <Text style={styles.targetRolesLabel}>Target roles:</Text>
                    <View style={styles.rolesList}>
                      {flag.target_roles.map((role, index) => (
                        <View key={index} style={styles.roleChip}>
                          <Text style={styles.roleChipText}>{role}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.flagFooter}>
                  <Text style={styles.flagTimestamp}>
                    Created: {new Date(flag.created_at).toLocaleDateString()}
                  </Text>
                  {flag.updated_at !== flag.created_at && (
                    <Text style={styles.flagTimestamp}>
                      Updated: {new Date(flag.updated_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {featureFlags.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="flag-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>No feature flags</Text>
                <Text style={styles.emptySubText}>Create your first feature flag to get started</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={theme.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {showCreateModal ? 'Create Feature Flag' : 'Edit Feature Flag'}
            </Text>
            <TouchableOpacity 
              onPress={showCreateModal ? createFeatureFlag : updateFeatureFlag}
              disabled={saving}
            >
              {saving ? (
                <EduDashSpinner size="small" color={theme.primary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Feature flag display name"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Key *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.key}
                onChangeText={(text) => setFormData(prev => ({ ...prev, key: text.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="feature_flag_key"
                placeholderTextColor={theme.textTertiary}
                editable={showCreateModal} // Only editable when creating
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Describe what this feature flag controls"
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Enabled</Text>
                <Switch
                  value={formData.is_enabled}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, is_enabled: value }))}
                  trackColor={{ false: theme.border, true: theme.primary + '40' }}
                  thumbColor={formData.is_enabled ? theme.primary : theme.textTertiary}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Rollout Percentage</Text>
              <View style={styles.sliderContainer}>
                <TextInput
                  style={styles.percentageInput}
                  value={formData.rollout_percentage.toString()}
                  onChangeText={(text) => {
                    const value = Math.min(100, Math.max(0, parseInt(text) || 0));
                    setFormData(prev => ({ ...prev, rollout_percentage: value }));
                  }}
                  keyboardType="numeric"
                />
                <Text style={[styles.percentageLabel, { color: theme.text }]}>%</Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Environment</Text>
              <View style={styles.environmentPicker}>
                {environments.map((env) => (
                  <TouchableOpacity
                    key={env}
                    style={[
                      styles.environmentOption,
                      formData.environment === env && styles.environmentOptionActive,
                      { borderColor: getEnvironmentColor(env) }
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, environment: env as any }))}
                  >
                    <Text style={[
                      styles.environmentOptionText,
                      formData.environment === env && { color: getEnvironmentColor(env) }
                    ]}>
                      {env.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Target Roles</Text>
              <View style={styles.rolesContainer}>
                {availableRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      formData.target_roles.includes(role) && styles.roleOptionActive
                    ]}
                    onPress={() => {
                      setFormData(prev => ({
                        ...prev,
                        target_roles: prev.target_roles.includes(role)
                          ? prev.target_roles.filter(r => r !== role)
                          : [...prev.target_roles, role]
                      }));
                    }}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      formData.target_roles.includes(role) && styles.roleOptionTextActive
                    ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <AlertModal {...alertProps} />
    </View>
  );
}
