import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function StudentDashboard() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;
  
  // Wait for auth and profile to finish loading before making routing decisions
  const isStillLoading = loading || profileLoading;

  // CONSOLIDATED NAVIGATION EFFECT: Single source of truth for all routing decisions
  useEffect(() => {
    // Skip if still loading data
    if (isStillLoading) return;
    
    // Guard against double navigation (React StrictMode in dev)
    if (navigationAttempted.current) return;
    
    // Decision 1: No user -> sign in
    if (!user) {
      navigationAttempted.current = true;
      try { 
        router.replace('/(auth)/sign-in'); 
      } catch (e) {
        try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
      }
      return;
    }
    
    // Decision 2: User exists but no organization -> onboarding
    if (!orgId) {
      navigationAttempted.current = true;
      console.log('Student dashboard: No school found, redirecting to onboarding', {
        profile,
        organization_id: profile?.organization_id,
        preschool_id: (profile as any)?.preschool_id,
      });
      try { 
        router.replace('/screens/onboarding'); 
      } catch (e) {
        console.debug('Redirect to onboarding failed', e);
      }
      return;
    }
    
    // Decision 3: All good, stay on dashboard (no navigation needed)
  }, [isStillLoading, user, orgId, profile]);

  // Show loading state while auth/profile is loading
  if (isStillLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }) }} />
        <View style={styles.empty}>
          <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
        </View>
      </View>
    );
  }

  // Show redirect message if no organization after loading is complete
  if (!orgId) {
    // If not authenticated, show loading state
    if (!user) {
      return (
        <View style={styles.container}>
          <Stack.Screen options={{ title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }) }} />
          <View style={styles.empty}>
            <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }) }} />
        <View style={styles.empty}>
          <Text style={styles.loadingText}>{t('dashboard.no_school_found_redirect', { defaultValue: 'No school found. Redirecting to setup...' })}</Text>
          <TouchableOpacity onPress={() => {
            try { router.replace('/screens/onboarding'); } catch (e) { console.debug('Redirect failed', e); }
          }}>
            <Text style={[styles.loadingText, { textDecorationLine: 'underline', marginTop: 12 }]}>{t('common.go_now', { defaultValue: 'Go Now' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('student.dashboard_title', { defaultValue: 'Student Dashboard' }) }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('student.welcome', { defaultValue: 'Welcome Student' })}</Text>
        <Text style={styles.subheading}>{t('student.description', { defaultValue: 'Assignments, attendance, and grades will appear here.' })}</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16 },
  heading: { color: theme?.text || '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subheading: { color: theme?.textSecondary || '#9CA3AF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme?.text || '#E5E7EB', fontSize: 16 },
});
