import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useAlertModal } from '@/components/ui/AlertModal';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
type PendingActivity = {
  id: string;
  title: string;
  created_at: string;
  activity_type: string | null;
  subject: string | null;
  age_group_min: number | null;
  age_group_max: number | null;
};

export default function PrincipalActivityApprovalsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);
  const { profile, user } = useAuth();
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingActivity[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const schoolId = profile?.preschool_id || profile?.organization_id || null;

  const loadPending = useCallback(async () => {
    if (!schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await assertSupabase()
        .from('interactive_activities')
        .select('id, title, created_at, activity_type, subject, age_group_min, age_group_max')
        .eq('preschool_id', schoolId)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data || []) as PendingActivity[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load approvals.';
      showAlert({ title: 'Unable to load', message, buttons: [{ text: 'OK' }] });
    } finally {
      setLoading(false);
    }
  }, [schoolId, showAlert]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleApprove = (activityId: string) => {
    showAlert({
      title: 'Approve activity?',
      message: 'This will publish the activity for teachers and learners.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActioningId(activityId);
              const { error } = await assertSupabase()
                .from('interactive_activities')
                .update({
                  approval_status: 'approved',
                  approved_by: user?.id ?? null,
                  approved_at: new Date().toISOString(),
                  is_active: true,
                  is_published: true,
                })
                .eq('id', activityId);
              if (error) throw error;
              setItems((prev) => prev.filter((item) => item.id !== activityId));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to approve activity.';
              showAlert({ title: 'Approval failed', message, buttons: [{ text: 'OK' }] });
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    });
  };

  const handleReject = (activityId: string) => {
    showAlert({
      title: 'Reject activity?',
      message: 'The activity will remain unpublished.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActioningId(activityId);
              const { error } = await assertSupabase()
                .from('interactive_activities')
                .update({
                  approval_status: 'rejected',
                  approved_by: user?.id ?? null,
                  approved_at: new Date().toISOString(),
                  is_active: false,
                  is_published: false,
                })
                .eq('id', activityId);
              if (error) throw error;
              setItems((prev) => prev.filter((item) => item.id !== activityId));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to reject activity.';
              showAlert({ title: 'Rejection failed', message, buttons: [{ text: 'OK' }] });
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Activity Approvals', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Pending Activity Approvals</Text>
          <TouchableOpacity style={[styles.refreshButton, { borderColor: theme.border }]} onPress={loadPending}>
            <Ionicons name="refresh" size={18} color={theme.text} />
            <Text style={[styles.refreshText, { color: theme.text }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading approvals...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={56} color={theme.textTertiary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              No pending teacher activities right now.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: theme.warning + '22' }]}>
                  <Text style={[styles.badgeText, { color: theme.warning }]}>Pending</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {item.activity_type ? item.activity_type.replace(/_/g, ' ') : 'Activity'} •{' '}
                {item.subject || 'General'}
              </Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                Ages {item.age_group_min ?? 1}-{item.age_group_max ?? 6} •{' '}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton, { borderColor: theme.error }]}
                  onPress={() => handleReject(item.id)}
                  disabled={actioningId === item.id}
                >
                  <Text style={[styles.actionText, { color: theme.error }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton, { backgroundColor: theme.success }]}
                  onPress={() => handleApprove(item.id)}
                  disabled={actioningId === item.id}
                >
                  <Text style={[styles.actionText, { color: theme.onPrimary }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <AlertModalComponent />
    </View>
  );
}

const createStyles = (theme: ThemeColors, insetBottom: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { padding: 16, paddingBottom: insetBottom + 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '700' },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    refreshText: { marginLeft: 6, fontSize: 12, fontWeight: '600' },
    loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 13 },
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
    emptySubtitle: { fontSize: 13, marginTop: 6, textAlign: 'center' },
    card: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    meta: { marginTop: 6, fontSize: 12 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rejectButton: { borderWidth: 1, backgroundColor: 'transparent' },
    approveButton: { borderWidth: 0 },
    actionText: { fontSize: 13, fontWeight: '700' },
  });
