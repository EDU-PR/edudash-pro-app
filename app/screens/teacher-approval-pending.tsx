import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { useAlertModal, AlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type ApprovalState = 'pending' | 'approved' | 'rejected' | 'unknown';

export default function TeacherApprovalPendingScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const params = useLocalSearchParams<{ state?: string }>();
  const { showAlert, alertProps } = useAlertModal();

  const [state, setState] = useState<ApprovalState>('unknown');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [principalEmail, setPrincipalEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const schoolId = profile?.organization_id || profile?.preschool_id || null;

  const loadStatus = useCallback(async () => {
    if (!user?.id || !schoolId) {
      setState(params.state === 'rejected' ? 'rejected' : 'pending');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = assertSupabase();

      const [{ data: approval, error: approvalError }, { data: principal }] = await Promise.all([
        supabase
          .from('teacher_approvals')
          .select('status, rejection_reason, reviewed_at')
          .eq('teacher_id', user.id)
          .eq('preschool_id', schoolId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('email')
          .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
          .in('role', ['principal', 'principal_admin'])
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
      ]);

      if (approvalError) {
        console.warn('[TeacherApprovalPending] approval lookup warning:', approvalError.message);
      }

      setPrincipalEmail(principal?.email || null);
      setRejectionReason(approval?.rejection_reason || null);
      setReviewedAt(approval?.reviewed_at || null);

      const nextState = (approval?.status as ApprovalState | null) || null;
      if (nextState === 'approved') {
        setState('approved');
        router.replace('/screens/teacher-dashboard');
        return;
      }
      if (nextState === 'rejected') {
        setState('rejected');
        return;
      }
      if (nextState === 'pending') {
        setState('pending');
        return;
      }

      setState(params.state === 'rejected' ? 'rejected' : 'pending');
    } catch (error) {
      console.warn('[TeacherApprovalPending] Failed to load status:', error);
      setState(params.state === 'rejected' ? 'rejected' : 'pending');
    } finally {
      setLoading(false);
    }
  }, [params.state, schoolId, user?.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Auto-refresh every 15 seconds to detect approval/rejection
  useEffect(() => {
    const interval = setInterval(() => {
      if (state === 'pending') loadStatus();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadStatus, state]);

  // Also refresh when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && state === 'pending') loadStatus();
    });
    return () => sub.remove();
  }, [loadStatus, state]);

  const handleContactPrincipal = useCallback(async () => {
    if (!principalEmail) {
      showAlert({ title: 'Contact Principal', message: 'Principal contact details are not available yet.', type: 'info' });
      return;
    }

    const subject = encodeURIComponent('Teacher approval follow-up');
    const body = encodeURIComponent('Hi Principal,\n\nI accepted my invite and I am following up on account approval.\n\nThank you.');
    const url = `mailto:${principalEmail}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showAlert({ title: 'Contact Principal', message: `Please email ${principalEmail} from your mail app.`, type: 'info' });
        return;
      }
      await Linking.openURL(url);
    } catch {
      showAlert({ title: 'Contact Principal', message: `Please email ${principalEmail} from your mail app.`, type: 'info' });
    }
  }, [principalEmail, showAlert]);

  const isRejected = state === 'rejected';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, title: 'Approval Pending' }} />

      <View style={styles.content}>
        {loading ? (
          <>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Checking approval status...</Text>
          </>
        ) : (
          <>
            <View style={[styles.iconWrap, { backgroundColor: isRejected ? theme.error + '20' : theme.primary + '20' }]}>
              <Ionicons
                name={isRejected ? 'close-circle-outline' : 'time-outline'}
                size={42}
                color={isRejected ? theme.error : theme.primary}
              />
            </View>

            <Text style={styles.title}>
              {isRejected ? 'Approval Not Completed' : 'Waiting for Principal Approval'}
            </Text>
            <Text style={styles.subtitle}>
              {isRejected
                ? 'Your invite was received, but this school has not approved your teacher account yet.'
                : 'Your invite was accepted successfully. A principal must approve your account before dashboard access is enabled.'}
            </Text>

            {isRejected && rejectionReason ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Reason</Text>
                <Text style={styles.infoValue}>{rejectionReason}</Text>
              </View>
            ) : null}

            {reviewedAt ? (
              <Text style={styles.reviewedText}>
                Last reviewed: {new Date(reviewedAt).toLocaleString()}
              </Text>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} onPress={loadStatus}>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Refresh Status</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleContactPrincipal}>
              <Ionicons name="mail-outline" size={18} color={theme.primary} />
              <Text style={styles.secondaryButtonText}>Contact Principal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tertiaryButton} onPress={() => router.replace('/screens/account')}>
              <Text style={styles.tertiaryButtonText}>Back to Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    loadingText: {
      marginTop: 14,
      color: theme.textSecondary,
      fontSize: 15,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    infoCard: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      marginBottom: 12,
    },
    infoTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    reviewedText: {
      fontSize: 12,
      color: theme.textTertiary,
      marginBottom: 18,
    },
    primaryButton: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 15,
    },
    secondaryButton: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: theme.surface,
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 15,
    },
    tertiaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    tertiaryButtonText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 14,
    },
  });
