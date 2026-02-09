import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import TeacherDashboardWrapper from '@/components/dashboard/TeacherDashboardWrapper';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { assertSupabase } from '@/lib/supabase';

export default function TeacherDashboardScreen() {
  const { user, profile, profileLoading, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  // Guard against React StrictMode double-invoke in development
  const navigationAttempted = useRef(false);
  const [approvalGateLoading, setApprovalGateLoading] = React.useState(false);

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
    
    // Decision 2: User exists but no organization -> allow standalone access
    // Teachers can use the dashboard without an organization (standalone mode)
    if (!orgId) return;

    // Decision 3: Enforce principal approval gate for school-linked teachers
    let cancelled = false;
    const checkTeacherApproval = async () => {
      try {
        setApprovalGateLoading(true);
        const { data: approval, error } = await assertSupabase()
          .from('teacher_approvals')
          .select('status')
          .eq('teacher_id', user.id)
          .eq('preschool_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled || error || !approval?.status || approval.status === 'approved') {
          return;
        }

        navigationAttempted.current = true;
        if (approval.status === 'rejected') {
          router.replace({ pathname: '/screens/teacher-approval-pending', params: { state: 'rejected' } } as any);
          return;
        }

        if (approval.status === 'pending') {
          router.replace('/screens/teacher-approval-pending');
        }
      } catch (approvalError) {
        console.warn('[TeacherDashboard] Approval gate check failed:', approvalError);
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
      <TeacherDashboardWrapper />
    </DesktopLayout>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme?.background || '#0b1220' },
  text: { color: theme?.text || '#E5E7EB', fontSize: 16 },
});
