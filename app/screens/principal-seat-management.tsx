// filepath: /media/king/5e026cdc-594e-4493-bf92-c35c231beea3/home/king/Desktop/dashpro/app/screens/principal-seat-management.tsx
// Principal Seat Management Screen - Refactored for WARP.md compliance (≤500 lines)

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { navigateBack } from '@/lib/navigation';
import { useSeatManagement } from '@/hooks/principal/useSeatManagement';
import {
  TeacherSection,
  SeatAssignmentForm,
  NoSubscriptionBanner,
} from '@/components/principal/seats';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function PrincipalSeatManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { user, profile, profileLoading, loading: authLoading } = useAuth();
  const navigationAttempted = useRef(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  const isStillLoading = authLoading || profileLoading;
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const [effectiveSchoolId, setEffectiveSchoolId] = useState<string | null>(orgId || null);

  // Set effective school id from profile
  useEffect(() => {
    if (!effectiveSchoolId && orgId) {
      setEffectiveSchoolId(orgId);
    }
  }, [effectiveSchoolId, orgId]);

  const seatManagement = useSeatManagement({ effectiveSchoolId });

  // Navigation effect - single source of truth
  useEffect(() => {
    if (isStillLoading) return;
    if (navigationAttempted.current) return;

    if (!user) {
      navigationAttempted.current = true;
      try {
        router.replace('/(auth)/sign-in');
      } catch {
        try {
          router.replace('/sign-in');
        } catch { /* Intentional: non-fatal */ }
      }
      return;
    }

    if (!orgId) {
      navigationAttempted.current = true;
      try {
        router.replace('/screens/principal-onboarding');
      } catch (_e) {
        // Redirect to onboarding silently failed
      }
    }
  }, [isStillLoading, user, orgId]);

  const headerOptions = {
    title: t('seat_management.title', { defaultValue: 'Seat Management' }),
    headerStyle: { backgroundColor: theme.headerBackground },
    headerTitleStyle: { color: theme.headerText },
    headerTintColor: theme.headerTint,
  };

  // Loading state
  if (isStillLoading) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <ThemedStatusBar />
        <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>
              {t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // No org state - redirect message
  if (!orgId) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <ThemedStatusBar />
        <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <View style={styles.loadingContainer}>
            <Ionicons name="school-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.loadingText}>
              {t('dashboard.no_school_found_redirect', { defaultValue: 'No school found. Redirecting to setup...' })}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/screens/principal-onboarding')}>
              <Text style={[styles.loadingText, { color: theme.primary, textDecorationLine: 'underline', marginTop: 12 }]}>
                {t('common.go_now', { defaultValue: 'Go Now' })}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <ThemedStatusBar />
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={seatManagement.refreshing}
              onRefresh={seatManagement.onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {/* Back Navigation */}
          <View style={styles.backRow}>
            <TouchableOpacity style={styles.backLink} onPress={() => navigateBack('/screens/principal-dashboard')}>
              <Ionicons name="chevron-back" size={20} color={theme.primary} />
              <Text style={[styles.backText, { color: theme.primary }]}>
                {t('common.back_to_dashboard', { defaultValue: 'Back to Dashboard' })}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Header */}
          <Text style={styles.title}>{t('seat_management.manage_seats', { defaultValue: 'Manage Seats' })}</Text>
          <Text style={styles.subtitle}>
            {t('seat_management.school', { defaultValue: 'School' })}: {seatManagement.schoolLabel || '—'}
          </Text>
          <Text style={styles.subtitle}>
            {t('seat_management.seats', { defaultValue: 'Seats' })}:{' '}
            {seatManagement.seats ? `${seatManagement.seats.used}/${seatManagement.seats.total}` : '—'}
          </Text>

          {/* Bulk assign button */}
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnPrimary,
              (!seatManagement.subscriptionId || seatManagement.assigning) && styles.btnDisabled,
            ]}
            disabled={!seatManagement.subscriptionId || seatManagement.assigning}
            onPress={seatManagement.onAssignAllTeachers}
          >
            {seatManagement.assigning ? (
              <EduDashSpinner color="#000" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                {t('seat_management.assign_all_teachers', { defaultValue: 'Assign all current teachers' })}
              </Text>
            )}
          </TouchableOpacity>

          {/* Loading indicator */}
          {seatManagement.loading && (
            <Text style={styles.info}>
              {t('seat_management.loading_subscription', { defaultValue: 'Loading subscription…' })}
            </Text>
          )}

          {/* No subscription banner */}
          {seatManagement.subscriptionLoaded && !seatManagement.subscriptionId && (
            <NoSubscriptionBanner
              onStartFreeTrial={seatManagement.onStartFreeTrial}
              theme={theme}
              isDark={isDark}
            />
          )}

          {/* Error/Success messages */}
          {seatManagement.error && <Text style={styles.error}>{seatManagement.error}</Text>}
          {seatManagement.success && <Text style={styles.success}>{seatManagement.success}</Text>}

          {/* Manual assignment form */}
          <SeatAssignmentForm
            subscriptionId={seatManagement.subscriptionId}
            assigning={seatManagement.assigning}
            revoking={seatManagement.revoking}
            onAssign={seatManagement.onAssign}
            onRevoke={seatManagement.onRevoke}
            theme={theme}
            isDark={isDark}
          />

          {/* AI Allocation button */}
          {seatManagement.canManageAI && (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => router.push('/screens/admin-ai-allocation')}
            >
              <Text style={styles.btnPrimaryText}>
                {t('seat_management.manage_ai_allocation', { defaultValue: 'Manage AI Allocation' })}
              </Text>
            </TouchableOpacity>
          )}

          {/* Teacher list */}
          <TeacherSection
            teachers={seatManagement.teachers}
            pendingTeacherId={seatManagement.pendingTeacherId}
            subscriptionId={seatManagement.subscriptionId}
            onAssignTeacher={seatManagement.onAssignTeacher}
            onRevokeTeacher={seatManagement.onRevokeTeacher}
            theme={theme}
            isDark={isDark}
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: {
      padding: 16,
      gap: 12,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },
    backRow: {
      marginBottom: 8,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backText: {
      fontWeight: '800',
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    info: {
      color: theme.textSecondary,
    },
    error: {
      color: theme.error,
    },
    success: {
      color: theme.success,
    },
    btn: {
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
    },
    btnPrimary: {
      backgroundColor: theme.primary,
    },
    btnPrimaryText: {
      color: theme.onPrimary,
      fontWeight: '800',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
