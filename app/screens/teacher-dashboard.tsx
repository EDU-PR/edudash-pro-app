import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { NewEnhancedTeacherDashboard } from '@/components/dashboard/NewEnhancedTeacherDashboard';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeOverrideProvider, useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { resolveTeacherApproval } from '@/lib/utils/resolveTeacherApproval';
import { nextGenTeacher } from '@/theme/nextgenTeacher';

export default function TeacherDashboardScreen() {
  return (
    <ThemeOverrideProvider override={nextGenTeacher}>
      <TeacherDashboardInner />
    </ThemeOverrideProvider>
  );
}

function TeacherDashboardInner() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);
  const [approvalGateLoading, setApprovalGateLoading] = React.useState(false);

  // Handle both organization_id (new RBAC) and preschool_id (legacy) fields
  const orgId = profile?.organization_id || profile?.preschool_id;
  
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
    
    // Decision 2: User exists but no organization -> allow standalone access
    // Teachers can use the dashboard without an organization (standalone mode)
    if (!orgId) return;

    // Decision 3: Enforce principal approval gate for school-linked teachers
    let cancelled = false;
    const checkTeacherApproval = async () => {
      try {
        setApprovalGateLoading(true);
        const result = await resolveTeacherApproval(user.id, orgId);

        if (cancelled) return;

        if (result.allowed) return;

        navigationAttempted.current = true;
        if ('status' in result && result.status === 'rejected') {
          router.replace({ pathname: '/screens/teacher-approval-pending', params: { state: 'rejected' } } as any);
        } else {
          router.replace('/screens/teacher-approval-pending');
        }
      } finally {
        if (!cancelled) {
          setApprovalGateLoading(false);
        }
      }
    };

    void checkTeacherApproval();
    return () => {
      cancelled = true;
    };
  }, [isStillLoading, user, orgId, profile]);

  // Show loading state while auth/profile is loading
  if (isStillLoading || approvalGateLoading) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.text}>
          {approvalGateLoading
            ? t('dashboard.checking_access', { defaultValue: 'Checking your access...' })
            : t('dashboard.loading_profile', { defaultValue: 'Loading your profile...' })}
        </Text>
      </View>
    );
  }

  // Allow access without organization - teachers can use standalone dashboard
  // Show dashboard content even if no organization (standalone mode)

  return (
    <DesktopLayout role="teacher">
      <Stack.Screen options={{ headerShown: false }} />
      <NewEnhancedTeacherDashboard />
    </DesktopLayout>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme?.background || '#0b1220' },
  text: { color: theme?.text || '#E5E7EB', fontSize: 16 },
});
