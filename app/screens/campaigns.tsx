/**
 * Campaigns Screen (React Native)
 * 
 * Marketing campaigns management for principals.
 * Allows creating, editing, and tracking promotional campaigns.
 * Feature-flagged: Only active when campaigns_enabled is true.
 * 
 * Refactored to use extracted components from components/campaigns/
 */

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Campaign,
  useCampaigns,
  CampaignCard,
  CampaignModal,
  CampaignStats,
  EmptyState,
} from '@/components/campaigns';

export default function CampaignsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const flags = getFeatureFlagsSync();

  const {
    campaigns,
    loading,
    refreshing,
    saving,
    showCreateModal,
    editingCampaign,
    formState,
    orgId,
    isStillLoading,
    activeCampaignsCount,
    totalConversions,
    openCreateModal,
    closeModal,
    openEditModal,
    updateFormField,
    saveCampaign,
    deleteCampaign,
    shareCampaign,
    toggleCampaignStatus,
    testConversion,
    onRefresh,
  } = useCampaigns();

  // Loading state
  if (isStillLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {t('common.loading', 'Loading...')}
        </Text>
      </View>
    );
  }

  // No organization fallback
  if (!orgId) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="business-outline" size={64} color={theme.muted} />
        <Text style={[styles.disabledText, { color: theme.text }]}>
          {t('common.noOrganization', 'No organization found')}
        </Text>
        <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
          {t('common.contactAdmin', 'Please contact your administrator')}
        </Text>
      </View>
    );
  }

  // Feature flag check - campaigns not enabled
  if (!flags.campaigns_enabled) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Campaigns',
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerTitleStyle: { color: theme.text },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.headerButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={[styles.container, styles.centered]}>
          <Ionicons name="megaphone-outline" size={64} color={theme.muted} />
          <Text style={[styles.disabledText, { color: theme.text }]}>
            Campaigns feature is not available
          </Text>
          <Text style={[styles.disabledSubtext, { color: theme.muted }]}>
            Please upgrade your subscription to access marketing campaigns.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderCampaignCard = ({ item }: { item: Campaign }) => (
    <CampaignCard
      campaign={item}
      theme={theme}
      isDark={isDark}
      onPress={() => openEditModal(item)}
      onToggleStatus={() => toggleCampaignStatus(item)}
      onShare={() => shareCampaign(item)}
      onDelete={() => deleteCampaign(item)}
      onTestConversion={() => testConversion(item)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'Marketing Campaigns',
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={openCreateModal} style={styles.headerButton}>
              <Ionicons name="add-circle" size={28} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Header Stats */}
      <CampaignStats
        totalCampaigns={campaigns.length}
        activeCampaigns={activeCampaignsCount}
        totalConversions={totalConversions}
        isDark={isDark}
        theme={theme}
      />

      {/* Campaign List */}
      {loading ? (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderCampaignCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState theme={theme} onCreateCampaign={openCreateModal} />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
            />
          }
        />
      )}

      {/* Create/Edit Modal */}
      <CampaignModal
        visible={showCreateModal}
        isEditing={!!editingCampaign}
        formState={formState}
        saving={saving}
        theme={theme}
        onClose={closeModal}
        onSave={saveCampaign}
        onUpdateField={updateFormField}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  disabledText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  disabledSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerButton: {
    marginRight: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
});
