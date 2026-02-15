import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { Ionicons } from '@expo/vector-icons';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useSuperAdminOrganizations } from '@/hooks/super-admin-organizations';
import type {
  OrganizationType,
  OrganizationStatus,
  Organization,
} from '@/lib/screen-styles/super-admin-organizations.styles';
import {
  theme,
  statusColors,
  typeColors,
  formatTierLabel,
  formatStatusLabel,
  createStyles,
} from '@/lib/screen-styles/super-admin-organizations.styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const styles = createStyles(theme);

export default function SuperAdminOrganizations() {
  const { showAlert, alertProps } = useAlertModal();

  const {
    filteredOrgs,
    stats,
    loading,
    refreshing,
    updatingSubscription,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedOrg,
    setSelectedOrg,
    showDetailModal,
    setShowDetailModal,
    showActionsModal,
    setShowActionsModal,
    onRefresh,
    handleOrgPress,
    handleOrgAction,
    openTierPicker,
    openStatusPicker,
  } = useSuperAdminOrganizations({ showAlert });

  const renderStatCell = (bg: string, value: number, label: string) => (
    <View style={[styles.statCard, { backgroundColor: bg + '20' }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderStatsCard = () => {
    if (!stats) return null;
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          {renderStatCell(theme.primary, stats.total, 'Total')}
          {renderStatCell('#8b5cf6', stats.preschools, 'Preschools')}
          {renderStatCell('#3b82f6', stats.k12_schools, 'K-12')}
          {renderStatCell('#10b981', stats.other_orgs, 'Organizations')}
        </View>
        <View style={styles.statsRow}>
          {renderStatCell(theme.success, stats.active, 'Active')}
          {renderStatCell(theme.warning, stats.pending, 'Pending')}
          {renderStatCell(theme.info, stats.verified, 'Verified')}
          {renderStatCell('#f59e0b', stats.with_subscription, 'Subscribed')}
        </View>
      </View>
    );
  };

  const typeLabel = (t: OrganizationType) =>
    t === 'all' ? 'All Types' : t === 'k12' ? 'K-12' : t.charAt(0).toUpperCase() + t.slice(1);

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search organizations..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'preschool', 'k12', 'skills', 'org'] as OrganizationType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterChip, selectedType === type && styles.filterChipActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[styles.filterChipText, selectedType === type && styles.filterChipTextActive]}>
              {typeLabel(type)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'active', 'pending', 'suspended', 'inactive'] as OrganizationStatus[]).map(status => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive,
              selectedStatus === status && { backgroundColor: statusColors[status] || theme.primary },
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text style={[styles.filterChipText, selectedStatus === status && styles.filterChipTextActive]}>
              {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOrganizationCard = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      style={styles.orgCard}
      onPress={() => handleOrgPress(item)}
      onLongPress={() => {
        setSelectedOrg(item);
        setShowActionsModal(true);
      }}
    >
      <View style={styles.orgHeader}>
        <View style={styles.orgTitleRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeColors[item.type] + '30' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColors[item.type] }]}>
              {item.type === 'k12' ? 'K-12' : item.type.toUpperCase()}
            </Text>
          </View>
          {item.is_verified && (
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
      
      <View style={styles.orgDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText} numberOfLines={1}>{item.contact_email || 'No email'}</Text>
        </View>
        {item.city && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>{item.city}{item.province ? `, ${item.province}` : ''}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.detailText}>
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.orgFooter}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setSelectedOrg(item);
            setShowActionsModal(true);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDetailModal = () => {
    if (!selectedOrg) return null;

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOrg.name}</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalSection}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Type</Text>
                  <View style={[styles.typeBadge, { backgroundColor: typeColors[selectedOrg.type] + '30' }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColors[selectedOrg.type] }]}>
                      {selectedOrg.type === 'k12' ? 'K-12 School' : 
                       selectedOrg.type.charAt(0).toUpperCase() + selectedOrg.type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[selectedOrg.status] + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColors[selectedOrg.status] }]} />
                    <Text style={[styles.statusText, { color: statusColors[selectedOrg.status] }]}>
                      {selectedOrg.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Verified</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.is_verified ? '✅ Yes' : '❌ No'}
                  </Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Email</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_email || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Phone</Text>
                  <Text style={styles.modalValue}>{selectedOrg.contact_phone || '-'}</Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Address</Text>
                  <Text style={styles.modalValue}>{selectedOrg.address || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>City</Text>
                  <Text style={styles.modalValue}>{selectedOrg.city || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Province</Text>
                  <Text style={styles.modalValue}>{selectedOrg.province || '-'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Country</Text>
                  <Text style={styles.modalValue}>{selectedOrg.country || '-'}</Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Activity</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Created</Text>
                  <Text style={styles.modalValue}>
                    {new Date(selectedOrg.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Last Active</Text>
                  <Text style={styles.modalValue}>
                    {selectedOrg.last_active_at 
                      ? new Date(selectedOrg.last_active_at).toLocaleDateString()
                      : '-'}
                  </Text>
                </View>
              </View>
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Subscription</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Tier</Text>
                  <Text style={styles.modalValue}>
                    {formatTierLabel(selectedOrg.subscription_tier)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Status</Text>
                  <Text style={styles.modalValue}>
                    {formatStatusLabel(selectedOrg.subscription_status)}
                  </Text>
                </View>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.info }]}
                    onPress={() => openTierPicker(selectedOrg)}
                    disabled={updatingSubscription}
                  >
                    <Ionicons name="cash-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Change Tier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                    onPress={() => openStatusPicker(selectedOrg)}
                    disabled={updatingSubscription}
                  >
                    <Ionicons name="flag-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Change Status</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleOrgAction('edit')}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Edit</Text>
                </TouchableOpacity>
                {!selectedOrg.is_verified && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: theme.success }]}
                    onPress={() => handleOrgAction('verify')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>Verify</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: theme.warning }]}
                  onPress={() => handleOrgAction('suspend')}
                >
                  <Ionicons name="pause-circle-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderActionsModal = () => {
    if (!selectedOrg) return null;

    const actions = [
      { id: 'view', label: 'View Details', icon: 'eye-outline', color: theme.primary },
      { id: 'edit', label: 'Edit Organization', icon: 'create-outline', color: theme.info },
      { id: 'verify', label: 'Verify Organization', icon: 'checkmark-circle-outline', color: theme.success },
      { id: 'suspend', label: 'Suspend Organization', icon: 'pause-circle-outline', color: theme.warning },
      { id: 'delete', label: 'Delete Organization', icon: 'trash-outline', color: theme.error },
    ];

    return (
      <Modal
        visible={showActionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={styles.actionsContent}>
            <Text style={styles.actionsTitle}>{selectedOrg.name}</Text>
            <Text style={styles.actionsSubtitle}>Quick Actions</Text>

            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={() => handleOrgAction(action.id)}
              >
                <Ionicons name={action.icon as any} size={22} color={action.color} />
                <Text style={[styles.actionItemText, { color: action.color }]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowActionsModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <ThemedStatusBar />
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading organizations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ThemedStatusBar />
      <Stack.Screen
        options={{
          title: 'Organizations',
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organizations</Text>
        <TouchableOpacity
          onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
          style={styles.headerButton}
        >
          <Ionicons name="add-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlashList
        data={filteredOrgs}
        keyExtractor={item => item.id}
        renderItem={renderOrganizationCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <>
            {renderStatsCard()}
            {renderFilters()}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredOrgs.length} organization{filteredOrgs.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No Organizations Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedType !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Start by onboarding your first organization'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/screens/super-admin/school-onboarding-wizard')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Onboard Organization</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        numColumns={SCREEN_WIDTH > 600 ? 2 : 1}
        key={SCREEN_WIDTH > 600 ? 'two-columns' : 'one-column'}
        estimatedItemSize={160}
      />

      {renderDetailModal()}
      {renderActionsModal()}
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}
