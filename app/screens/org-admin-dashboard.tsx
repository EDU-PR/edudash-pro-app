import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function OrgAdminDashboard() {
  const { t } = useTranslation();
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
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
      console.log('Org Admin dashboard: No organization found, redirecting to onboarding', {
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
      <Stack.Screen options={{ title: t('org_admin.title', { defaultValue: 'Organization Admin' }) }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('org_admin.overview', { defaultValue: 'Organization Overview' })}</Text>
        <View style={styles.kpiRow}>
          <KPI title={t('org_admin.kpi.active_learners', { defaultValue: 'Active Learners' })} value="--" theme={theme} />
          <KPI title={t('org_admin.kpi.completion_rate', { defaultValue: 'Completion Rate' })} value="--%" theme={theme} />
          <KPI title={t('org_admin.kpi.cert_pipeline', { defaultValue: 'Cert Pipeline' })} value="--" theme={theme} />
          <KPI title={t('org_admin.kpi.mrr', { defaultValue: 'MRR' })} value="$--" theme={theme} />
        </View>

        <Text style={styles.sectionTitle}>{t('org_admin.quick_actions', { defaultValue: 'Quick Actions' })}</Text>
        <View style={styles.row}>
          <ActionBtn label={t('org_admin.actions.programs', { defaultValue: 'Programs' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.cohorts', { defaultValue: 'Cohorts' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.instructors', { defaultValue: 'Instructors' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.enrollments', { defaultValue: 'Enrollments' })} theme={theme} />
        </View>
        <View style={styles.row}>
          <ActionBtn label={t('org_admin.actions.certifications', { defaultValue: 'Certifications' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.placements', { defaultValue: 'Placements' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.invoices', { defaultValue: 'Invoices' })} theme={theme} />
          <ActionBtn label={t('org_admin.actions.settings', { defaultValue: 'Settings' })} theme={theme} />
        </View>
      </ScrollView>
    </View>
  );
}

function KPI({ title, value, theme }: { title: string; value: string; theme: any }) {
  return (
    <View style={kpiStyles(theme).kpi}>
      <Text style={kpiStyles(theme).kpiValue}>{value}</Text>
      <Text style={kpiStyles(theme).kpiTitle}>{title}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress, theme }: { label: string; onPress?: () => void; theme: any }) {
  return (
    <TouchableOpacity style={actionStyles(theme).action} onPress={onPress}>
      <Text style={actionStyles(theme).actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const kpiStyles = (theme: any) => StyleSheet.create({
  kpi: { flexBasis: '48%', backgroundColor: theme?.card || '#111827', padding: 12, borderRadius: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1 },
  kpiValue: { color: theme?.text || '#fff', fontSize: 22, fontWeight: '800' },
  kpiTitle: { color: theme?.textSecondary || '#9CA3AF', marginTop: 4 },
});

const actionStyles = (theme: any) => StyleSheet.create({
  action: { flexBasis: '48%', backgroundColor: theme?.card || '#111827', padding: 14, borderRadius: 12, borderColor: theme?.border || '#1f2937', borderWidth: 1, alignItems: 'center' },
  actionText: { color: theme?.text || '#fff', fontWeight: '700' },
});

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, gap: 12 },
  heading: { color: theme?.text || '#fff', fontSize: 20, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { color: theme?.text || '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme?.text || '#E5E7EB', fontSize: 16 },
});
