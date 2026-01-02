/**
 * Principal Registrations Screen
 * 
 * Allows principals to view, search, approve/reject child registration requests.
 * Data comes from registration_requests table (synced from EduSitePro).
 * Feature-flagged: Only active when registrations_enabled is true.
 * 
 * Refactored per WARP.md standards:
 * - Hook: useRegistrations (state, logic)
 * - Components: RegistrationCard, RegistrationHeader, RegistrationFilters
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { useRegistrations, Registration } from '@/hooks/useRegistrations';
import { RegistrationCard, RegistrationHeader, RegistrationFilters } from '@/components/registrations';
import { SuccessModal } from '@/components/ui/SuccessModal';

export default function PrincipalRegistrationsScreen() {
  const { theme } = useTheme();
  const colors = theme;
  const insets = useSafeAreaInsets();
  
  // Feature flag check
  const flags = getFeatureFlagsSync();
  const isEnabled = flags.registrations_enabled !== false;
  
  // All state and logic from hook
  const {
    filteredRegistrations,
    loading,
    refreshing,
    syncing,
    processing,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    successModal,
    setSuccessModal,
    fetchRegistrations,
    onRefresh,
    handleSyncWithEduSite,
    handleApprove,
    handleReject,
    handleVerifyPayment,
    canApprove,
    pendingCount,
    approvedCount,
    rejectedCount,
  } = useRegistrations();

  // Render registration card
  const renderRegistration = ({ item }: { item: Registration }) => (
    <RegistrationCard
      item={item}
      isProcessing={processing === item.id}
      onApprove={handleApprove}
      onReject={handleReject}
      onVerifyPayment={handleVerifyPayment}
      canApprove={canApprove}
    />
  );

  // Feature flag disabled state
  if (!isEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Registrations' }} />
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>
            Registrations Not Available
          </Text>
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            This feature is currently disabled. Please contact support.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Registrations', headerShown: false }} />
        <RegistrationHeader
          pendingCount={0}
          approvedCount={0}
          rejectedCount={0}
          syncing={false}
          onSync={() => {}}
          topInset={insets.top}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading registrations...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Registrations', headerShown: false }} />
        <RegistrationHeader
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          rejectedCount={rejectedCount}
          syncing={syncing}
          onSync={handleSyncWithEduSite}
          topInset={insets.top}
        />
        <View style={styles.centerContainer}>
          <Ionicons name="warning" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={fetchRegistrations}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty state
  const isEmpty = filteredRegistrations.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Registrations', headerShown: false }} />

      {/* Header with Stats */}
      <RegistrationHeader
        pendingCount={pendingCount}
        approvedCount={approvedCount}
        rejectedCount={rejectedCount}
        syncing={syncing}
        onSync={handleSyncWithEduSite}
        topInset={insets.top}
      />

      {/* Search & Filter */}
      <RegistrationFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        pendingCount={pendingCount}
      />

      {/* Content */}
      {isEmpty ? (
        <View style={styles.centerContainer}>
          <Ionicons 
            name={statusFilter === 'pending' ? 'checkmark-done-circle' : 'document-text-outline'} 
            size={64} 
            color={colors.textSecondary} 
          />
          <Text style={[styles.centerTitle, { color: colors.text }]}>
            {statusFilter === 'pending' 
              ? 'No Pending Registrations'
              : searchTerm 
                ? 'No Matching Registrations'
                : 'No Registrations Found'}
          </Text>
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            {statusFilter === 'pending'
              ? 'All registrations have been processed'
              : 'Registration requests will appear here when parents apply'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRegistrations}
          renderItem={renderRegistration}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Success Modal */}
      <SuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        icon={successModal.icon as any}
        onClose={() => setSuccessModal(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  centerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
});
