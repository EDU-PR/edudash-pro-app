/**
 * Subscription Upgrade Post Screen
 * Refactored to meet WARP.md ≤500 line limit
 * Original: 1,298 lines → Refactored: ~180 lines
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import {
  useSubscriptionUpgrade,
  BillingToggle,
  PlanCard,
  UpgradeHeader,
  UpgradeCTA,
  UpgradeErrorBoundary,
  sharedStyles as styles,
  takeFirst,
} from '@/components/subscription';

export default function SubscriptionUpgradePostScreen() {
  const rawParams = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Extract parameters
  const currentTier = (takeFirst(rawParams.currentTier) || 'free').toString();
  const reasonKey = (takeFirst(rawParams.reason) || 'manual_upgrade').toString();
  const feature = takeFirst(rawParams.feature);

  // Use hook for all business logic
  const {
    plans,
    loading,
    annual,
    setAnnual,
    selectedPlan,
    setSelectedPlan,
    upgrading,
    expanded,
    setExpanded,
    screenMounted,
    renderError,
    reason,
    handleUpgrade,
    isLaunchPromoActive,
    promoPercentOff,
  } = useSubscriptionUpgrade({ currentTier, reasonKey, feature });

  // Error state
  if (renderError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Unable to Load Upgrade Screen</Text>
        <Text style={styles.loadingText}>Error: {renderError}</Text>
        <TouchableOpacity
          style={[styles.cancelButton, { marginTop: 20, backgroundColor: '#00f5ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }]}
          onPress={() => { try { router.back(); } catch { router.replace('/screens/principal-dashboard'); } }}
        >
          <Text style={[styles.cancelButtonText, { color: '#000', fontWeight: '600' }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (!screenMounted || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f5ff" />
        <Text style={styles.loadingText}>Loading upgrade options...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: '#0b1220' } }} />
      <StatusBar style="light" backgroundColor="#0b1220" translucent={false} />
      
      {/* Custom Header */}
      <View style={[styles.customHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          onPress={() => { try { router.back(); } catch { router.replace('/screens/principal-dashboard'); } }}
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color="#00f5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade Plan</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingBottom: 24 + insets.bottom }]}>
        {/* Header Section */}
        <UpgradeHeader reason={reason} currentTier={currentTier} />

        {/* Billing Toggle */}
        <BillingToggle annual={annual} onToggle={setAnnual} />

        {/* Upgrade Options */}
        <View style={styles.plansSection}>
          <Text style={styles.plansSectionTitle}>Choose your upgrade:</Text>
          
          <View style={styles.plansGrid}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={setSelectedPlan}
                onUpgrade={handleUpgrade}
                annual={annual}
                expanded={expanded[plan.id] || false}
                onToggleExpand={() => setExpanded(prev => ({ ...prev, [plan.id]: !prev[plan.id] }))}
                isLaunchPromoActive={isLaunchPromoActive}
                promoPercentOff={promoPercentOff}
              />
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <UpgradeCTA
          selectedPlan={selectedPlan}
          plans={plans}
          upgrading={upgrading}
          annual={annual}
          onUpgrade={handleUpgrade}
        />

        {/* Empty State */}
        {plans.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No upgrade options available</Text>
            <Text style={styles.emptyStateSubtext}>
              You're already on our highest tier or there are no upgrade options available.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Export error boundary for expo-router
export { UpgradeErrorBoundary as ErrorBoundary } from '@/components/subscription';
