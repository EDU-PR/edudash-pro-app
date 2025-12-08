/**
 * New Enhanced Principal Dashboard - Refactored
 * 
 * A modular, clean implementation following WARP.md file size standards.
 * Uses extracted components for better maintainability.
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Modern card design with subtle shadows and rounded corners
 * - Streamlined quick actions with contextual grouping
 * - Better information architecture with progressive disclosure
 * - Enhanced loading states and error handling
 * - Optimized for touch interfaces and accessibility
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { usePrincipalHub } from '@/hooks/usePrincipalHub';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TierBadge from '@/components/ui/TierBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';

// Import modular components
import { 
  PrincipalWelcomeSection,
  PrincipalMetricsSection,
  PrincipalQuickActions,
  PrincipalRecentActivity
} from './principal';
import { CollapsibleSection, SearchBar, type SearchBarSuggestion } from './shared';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface NewEnhancedPrincipalDashboardProps {
  refreshTrigger?: number;
}

export const NewEnhancedPrincipalDashboard: React.FC<NewEnhancedPrincipalDashboardProps> = ({ 
  refreshTrigger 
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  const {
    data,
    loading,
    error,
    refresh,
    isEmpty
  } = usePrincipalHub();

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      await Feedback.vibrate(10);
    } catch (_error) {
      console.error('Refresh error:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  // Search suggestions for PWA-style search
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => [
    { id: 'registrations', label: t('quick_actions.registrations', { defaultValue: 'Registrations' }), icon: 'person-add' },
    { id: 'teachers', label: t('quick_actions.manage_teachers', { defaultValue: 'Manage Teachers' }), icon: 'people' },
    { id: 'students', label: t('dashboard.student_management', { defaultValue: 'Student Management' }), icon: 'school' },
    { id: 'finances', label: t('quick_actions.view_finances', { defaultValue: 'View Finances' }), icon: 'analytics' },
    { id: 'reports', label: t('dashboard.view_reports', { defaultValue: 'View Reports' }), icon: 'bar-chart' },
    { id: 'calendar', label: t('dashboard.calendar', { defaultValue: 'Calendar' }), icon: 'calendar' },
  ], [t]);

  const handleSearchNavigation = (actionId: string) => {
    switch (actionId) {
      case 'registrations':
        router.push('/screens/principal-registrations');
        break;
      case 'teachers':
        router.push('/screens/teacher-management');
        break;
      case 'students':
        router.push('/screens/student-management');
        break;
      case 'finances':
        router.push('/screens/financial-dashboard');
        break;
      case 'reports':
        router.push('/screens/teacher-reports');
        break;
      case 'calendar':
        router.push('/screens/calendar');
        break;
    }
  };

  if (loading && isEmpty) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (error && isEmpty) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={64} color={theme.error} />
        <Text style={styles.errorTitle}>{t('dashboard.load_error')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={[styles.scrollContainer, Platform.OS === 'web' && styles.scrollContainerWeb]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Welcome Section */}
        <View style={[styles.section, styles.firstSection, Platform.OS === 'web' && styles.firstSectionWeb]}>
          <PrincipalWelcomeSection
            userName={user?.user_metadata?.first_name}
            tier={tier}
            subscriptionReady={subscriptionReady}
          />
        </View>

        {/* PWA-Style Search Bar */}
        <View style={styles.section}>
          <SearchBar
            placeholder={t('common.search', { defaultValue: 'Search dashboard...' })}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={(query) => {
              const match = searchSuggestions.find(s => 
                s.label.toLowerCase().includes(query.toLowerCase())
              );
              if (match) handleSearchNavigation(match.id);
            }}
            suggestions={searchSuggestions}
            onSuggestionPress={(suggestion) => handleSearchNavigation(suggestion.id)}
          />
        </View>

        {/* Metrics Sections */}
        <View style={styles.section}>
          <PrincipalMetricsSection
            stats={data.stats}
            studentsCount={data.studentsCount}
            classesCount={data.classesCount}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <PrincipalQuickActions
            stats={data.stats}
            pendingRegistrationsCount={data.stats?.pendingRegistrations?.total ?? 0}
            pendingPaymentsCount={data.stats?.pendingPayments?.total ?? 0}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* Parent Link Requests */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('dashboard.parent_requests', { defaultValue: 'Parent Requests' })} 
            sectionId="parent-requests" 
            icon="👨‍👩‍👧"
            defaultCollapsed={collapsedSections.has('parent-requests')}
            onToggle={toggleSection}
          >
            <PendingParentLinkRequests />
          </CollapsibleSection>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <PrincipalRecentActivity
            stats={data.stats}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
          />
        </View>

        {/* Financial Overview */}
        <View style={styles.section}>
          <CollapsibleSection 
            title={t('dashboard.financial_overview', { defaultValue: 'Financial Overview' })} 
            sectionId="financials" 
            icon="💰"
            defaultCollapsed={collapsedSections.has('financials')}
            onToggle={toggleSection}
          >
            <View style={styles.financialGrid}>
              <View style={styles.financialCard}>
                <Text style={styles.financialLabel}>{t('dashboard.monthly_revenue', { defaultValue: 'Monthly Revenue' })}</Text>
                <Text style={[styles.financialValue, { color: '#10B981' }]}>
                  R{(data.stats?.registrationFees?.total ?? data.financialSummary?.monthlyRevenue ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.financialCard}>
                <Text style={styles.financialLabel}>{t('dashboard.net_profit', { defaultValue: 'Net Profit' })}</Text>
                <Text style={[styles.financialValue, { 
                  color: ((data.stats?.registrationFees?.total ?? data.financialSummary?.netProfit ?? 0) - (data.financialSummary?.estimatedExpenses ?? 0)) >= 0 ? '#10B981' : '#EF4444' 
                }]}>
                  R{((data.stats?.registrationFees?.total ?? data.financialSummary?.monthlyRevenue ?? 0) - (data.financialSummary?.estimatedExpenses ?? 0)).toLocaleString()}
                </Text>
              </View>
            </View>
          </CollapsibleSection>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any, insetTop = 0, insetBottom = 0) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContainerWeb: {
      marginTop: 0,
    },
    scrollContent: {
      paddingTop: isSmallScreen ? 8 : 12,
      paddingBottom: insetBottom + (isSmallScreen ? 56 : 72),
    },
    section: {
      paddingHorizontal: cardPadding,
      paddingVertical: isSmallScreen ? 6 : 8,
    },
    firstSection: {
      paddingTop: 0,
    },
    firstSectionWeb: {
      paddingTop: 0,
    },
    financialGrid: {
      flexDirection: 'row',
      gap: cardGap,
    },
    financialCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 12 : 16,
      flex: 1,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    financialLabel: {
      fontSize: isSmallScreen ? 12 : 14,
      color: theme.textSecondary,
      marginBottom: isSmallScreen ? 6 : 8,
      fontWeight: '500',
    },
    financialValue: {
      fontSize: isSmallScreen ? 20 : isTablet ? 28 : 24,
      fontWeight: '700',
      lineHeight: isSmallScreen ? 24 : isTablet ? 32 : 28,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      backgroundColor: theme.background,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
};

export default NewEnhancedPrincipalDashboard;
