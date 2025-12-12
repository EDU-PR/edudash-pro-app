import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DashboardHeader } from '@/components/org-admin/DashboardHeader';
import { MetricsCards } from '@/components/org-admin/MetricsCards';
import { QuickActionsGrid } from '@/components/org-admin/QuickActionsGrid';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';

export default function OrgAdminDashboard() {
  const { t } = useTranslation();
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
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
      console.log('Org Admin dashboard: No organization found, redirecting to onboarding', {
        profile,
        organization_id: profile?.organization_id,
        preschool_id: (profile as any)?.preschool_id,
      });
      try { 
        router.replace('/screens/org-onboarding'); 
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
        <Stack.Screen options={{ title: t('org_admin.title', { defaultValue: 'Organization Admin' }) }} />
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
          <Stack.Screen options={{ title: t('org_admin.title', { defaultValue: 'Organization Admin' }) }} />
          <View style={styles.empty}>
            <Text style={styles.loadingText}>{t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('org_admin.title', { defaultValue: 'Organization Admin' }) }} />
        <View style={styles.empty}>
          <Text style={styles.loadingText}>{t('dashboard.no_org_found_redirect', { defaultValue: 'No organization found. Redirecting to setup...' })}</Text>
          <TouchableOpacity onPress={() => {
            try { router.replace('/screens/org-onboarding'); } catch (e) { console.debug('Redirect failed', e); }
          }}>
            <Text style={[styles.loadingText, { textDecorationLine: 'underline', marginTop: 12 }]}>{t('common.go_now', { defaultValue: 'Go Now' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const orgAdminNavItems = [
    { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/org-admin-dashboard' },
    { id: 'programs', label: 'Programs', icon: 'school', route: '/screens/org-admin/programs' },
    { id: 'cohorts', label: 'Cohorts', icon: 'people', route: '/screens/org-admin/cohorts' },
    { id: 'instructors', label: 'Team', icon: 'briefcase', route: '/screens/org-admin/instructors' },
    { id: 'enrollments', label: 'Enrollments', icon: 'list', route: '/screens/org-admin/enrollments' },
    { id: 'certifications', label: 'Certifications', icon: 'ribbon', route: '/screens/org-admin/certifications' },
    { id: 'placements', label: 'Placements', icon: 'business', route: '/screens/org-admin/placements' },
    { id: 'invoices', label: 'Invoices', icon: 'document-text', route: '/screens/org-admin/invoices' },
    { id: 'data-import', label: 'Data Import', icon: 'cloud-upload', route: '/screens/org-admin/data-import' },
    { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/org-admin/settings' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen 
        options={{ 
          title: t('org_admin.title', { defaultValue: 'Organization Admin' }),
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => setDrawerOpen(true)}
              style={{ marginLeft: 16, padding: 8 }}
            >
              <Ionicons name="menu" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/screens/org-admin/settings' as any)}
              style={{ marginRight: 16, padding: 8 }}
            >
              <View style={styles.avatarButton}>
                <Ionicons name="person" size={18} color={theme.primary} />
              </View>
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader theme={theme} />
        
        <View style={styles.section}>
          <Text style={styles.heading}>
            {t('org_admin.overview', { defaultValue: 'Overview' })}
          </Text>
          <MetricsCards theme={theme} />
        </View>

        <View style={styles.section}>
          <QuickActionsGrid theme={theme} />
        </View>
      </ScrollView>

      <MobileNavDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navItems={orgAdminNavItems}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme?.background || '#0b1220' 
  },
  content: { 
    padding: 16, 
    gap: 24,
    paddingBottom: 32,
  },
  section: {
    gap: 12,
  },
  heading: { 
    color: theme?.text || '#fff', 
    fontSize: 20, 
    fontWeight: '800' 
  },
  empty: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  loadingText: { 
    color: theme?.text || '#E5E7EB', 
    fontSize: 16 
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme?.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
