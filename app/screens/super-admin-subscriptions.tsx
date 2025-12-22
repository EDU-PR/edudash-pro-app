/**
 * Super Admin Subscriptions Screen (Refactored)
 * Platform-wide subscription management for super admins
 *
 * WARP.md compliant: ~280 lines (target ≤500)
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useSubscriptions,
  SubscriptionCard,
  CreateSubscriptionModal,
  EmptyState,
  PlanChangeModal,
  SUBSCRIPTION_FILTERS,
} from '@/components/super-admin/subscriptions';

export default function SuperAdminSubscriptionsScreen() {
  const { theme } = useTheme();

  const {
    loading,
    refreshing,
    subscriptions,
    plans,
    filter,
    showCreateModal,
    creating,
    createForm,
    showPlanChangeModal,
    selectedSubscriptionForChange,
    selectedSchoolForChange,
    availableSchools,
    onRefresh,
    updateSubscriptionStatus,
    createSubscription,
    deleteSubscription,
    handleManualActivation,
    openPlanChangeModal,
    closePlanChangeModal,
    handlePlanChangeSuccess,
    setFilter,
    setShowCreateModal,
    setCreateForm,
  } = useSubscriptions();

  const handleBack = () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
          window.history.back();
          return;
        }
        router.replace('/screens/super-admin-dashboard' as `/${string}`);
        return;
      }
      router.back();
    } catch {
      router.replace('/screens/super-admin-dashboard' as `/${string}`);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Manage Subscriptions',
          headerBackVisible: true,
          headerShown: true,
          headerStyle: { backgroundColor: '#0b1220' },
          headerTitleStyle: { color: '#ffffff', fontWeight: '700' },
          headerTintColor: '#00f5ff',
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBack}
              accessibilityLabel="Go back"
              style={{ paddingHorizontal: 8 }}
            >
              <Ionicons name="arrow-back" size={22} color="#00f5ff" />
            </TouchableOpacity>
          ),
        }}
      />
      <StatusBar style="light" backgroundColor="#0b1220" />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#0b1220' }}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          style={{ backgroundColor: '#0b1220' }}
        >
          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.createButtonText}>+ Create Subscription</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filtersRow}>
            {SUBSCRIPTION_FILTERS.map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilter(status)}
                style={[styles.filterChip, filter === status && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filter === status && styles.filterChipTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && <Text style={styles.loading}>Loading subscriptions...</Text>}

          {/* Subscriptions List */}
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onUpgrade={openPlanChangeModal}
              onCancel={(id) => updateSubscriptionStatus(id, 'cancelled')}
              onReactivate={(id) => updateSubscriptionStatus(id, 'active')}
              onManualActivate={handleManualActivation}
              onDelete={deleteSubscription}
            />
          ))}

          {!loading && subscriptions.length === 0 && (
            <EmptyState
              availableSchools={availableSchools}
              plans={plans}
              onCreateClick={() => setShowCreateModal(true)}
              onSeedSuccess={onRefresh}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Create Subscription Modal */}
      <CreateSubscriptionModal
        visible={showCreateModal}
        theme={theme}
        creating={creating}
        createForm={createForm}
        availableSchools={availableSchools}
        plans={plans}
        onClose={() => setShowCreateModal(false)}
        onCreate={createSubscription}
        onFormChange={setCreateForm}
      />

      {/* Plan Change Modal */}
      <PlanChangeModal
        visible={showPlanChangeModal}
        onClose={closePlanChangeModal}
        subscription={selectedSubscriptionForChange}
        school={selectedSchoolForChange}
        onSuccess={handlePlanChangeSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: '#0b1220',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  createButton: {
    backgroundColor: '#00f5ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#00f5ff22',
    borderColor: '#00f5ff',
  },
  filterChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#00f5ff',
    fontWeight: '700',
  },
  loading: {
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
  },
});
