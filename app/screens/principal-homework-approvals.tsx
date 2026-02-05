import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useAlertModal } from '@/components/ui/AlertModal';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

type PendingHomework = {
  id: string;
  title: string;
  created_at: string;
  description: string | null;
  instructions: string | null;
  materials_needed: string | null;
  subject: string | null;
  estimated_time_minutes: number | null;
  due_date: string | null;
  due_date_offset_days: number | null;
  class_id: string | null;
  teacher_id?: string | null;
  class?: { name?: string | null } | null;
  teacher?: { email?: string | null; name?: string | null } | null;
  status: string | null;
};

export default function PrincipalHomeworkApprovalsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);
  const { profile, user } = useAuth();
  const { showAlert, AlertModalComponent } = useAlertModal();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingHomework[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PendingHomework | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

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
        .from('homework_assignments')
        .select(`
          id,
          title,
          created_at,
          description,
          instructions,
          materials_needed,
          subject,
          estimated_time_minutes,
          due_date,
          due_date_offset_days,
          class_id,
          teacher_id,
          status,
          class:classes(name)
        `)
        .eq('preschool_id', schoolId)
        .eq('is_published', false)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data || []) as PendingHomework[];
      const teacherIds = Array.from(new Set(rows.map((row) => row.teacher_id).filter(Boolean))) as string[];
      let teacherMap = new Map<string, PendingHomework['teacher']>();

      if (teacherIds.length > 0) {
        const { data: teachers, error: teachersError } = await assertSupabase()
          .from('user_profiles_with_tier')
          .select('id, name, email')
          .in('id', teacherIds);
        if (!teachersError && teachers) {
          teacherMap = new Map(
            teachers.map((teacher) => [
              teacher.id as string,
              { name: teacher.name ?? null, email: teacher.email ?? null },
            ])
          );
        }
      }

      setItems(
        rows.map((row) => ({
          ...row,
          teacher: row.teacher_id ? teacherMap.get(row.teacher_id) || row.teacher : row.teacher,
        }))
      );
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

  const computeDueDate = (item: PendingHomework): string | null => {
    if (item.due_date) return item.due_date;
    const offset = Number.isFinite(item.due_date_offset_days) ? (item.due_date_offset_days as number) : 3;
    const base = item.created_at ? new Date(item.created_at) : new Date();
    base.setDate(base.getDate() + offset);
    return base.toISOString().split('T')[0];
  };

  const handleApprove = (item: PendingHomework) => {
    showAlert({
      title: 'Approve homework?',
      message: 'This will publish the homework so parents can view it.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActioningId(item.id);
              const dueDate = computeDueDate(item);
              const { error } = await assertSupabase()
                .from('homework_assignments')
                .update({
                  is_published: true,
                  is_active: true,
                  status: 'assigned',
                  assigned_at: new Date().toISOString(),
                  due_date: dueDate,
                })
                .eq('id', item.id);
              if (error) throw error;
              setItems((prev) => prev.filter((row) => row.id !== item.id));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to approve homework.';
              showAlert({ title: 'Approval failed', message, buttons: [{ text: 'OK' }] });
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    });
  };

  const handleReject = (item: PendingHomework) => {
    showAlert({
      title: 'Reject homework?',
      message: 'The homework will remain unpublished.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setActioningId(item.id);
              const { error } = await assertSupabase()
                .from('homework_assignments')
                .update({
                  is_published: false,
                  is_active: false,
                  status: 'archived',
                  closed_at: new Date().toISOString(),
                })
                .eq('id', item.id);
              if (error) throw error;
              setItems((prev) => prev.filter((row) => row.id !== item.id));
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to reject homework.';
              showAlert({ title: 'Rejection failed', message, buttons: [{ text: 'OK' }] });
            } finally {
              setActioningId(null);
            }
          },
        },
      ],
    });
  };

  const handleViewDetails = (item: PendingHomework) => {
    setSelectedItem(item);
    setDetailVisible(true);
  };

  const closeDetails = () => {
    setDetailVisible(false);
    setSelectedItem(null);
  };

  const getTeacherLabel = (item: PendingHomework) => {
    return item.teacher?.name || item.teacher?.email || 'Teacher';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Homework Approvals', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Pending Homework Approvals</Text>
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
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>No pending homework right now.</Text>
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
                Class: {item.class?.name || 'Unassigned'}
              </Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}> 
                Teacher: {getTeacherLabel(item)}
              </Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}> 
                Due: {computeDueDate(item) || 'TBD'} • {new Date(item.created_at).toLocaleDateString()}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton, { borderColor: theme.primary }]}
                  onPress={() => handleViewDetails(item)}
                >
                  <Text style={[styles.actionText, { color: theme.primary }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton, { borderColor: theme.error }]}
                  onPress={() => handleReject(item)}
                  disabled={actioningId === item.id}
                >
                  <Text style={[styles.actionText, { color: theme.error }]}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton, { backgroundColor: theme.success }]}
                  onPress={() => handleApprove(item)}
                  disabled={actioningId === item.id}
                >
                  <Text style={[styles.actionText, { color: theme.onPrimary }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Homework Preview</Text>
              <TouchableOpacity onPress={closeDetails}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedItem ? (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalHeading, { color: theme.text }]}>
                  {selectedItem.title}
                </Text>
                <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                  Class: {selectedItem.class?.name || 'Unassigned'}
                </Text>
                <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                  Teacher: {getTeacherLabel(selectedItem)}
                </Text>
                <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                  Subject: {selectedItem.subject || 'General'}
                </Text>
                <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                  Due: {computeDueDate(selectedItem) || 'TBD'}
                </Text>
                {Number.isFinite(selectedItem.estimated_time_minutes) && (
                  <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                    Estimated Time: {selectedItem.estimated_time_minutes} mins
                  </Text>
                )}

                {selectedItem.description ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>Description</Text>
                    <Text style={[styles.sectionText, { color: theme.textSecondary }]}>
                      {selectedItem.description}
                    </Text>
                  </>
                ) : null}

                {selectedItem.instructions ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>Instructions</Text>
                    <Text style={[styles.sectionText, { color: theme.textSecondary }]}>
                      {selectedItem.instructions}
                    </Text>
                  </>
                ) : null}

                {selectedItem.materials_needed ? (
                  <>
                    <Text style={[styles.sectionLabel, { color: theme.text }]}>Materials Needed</Text>
                    <Text style={[styles.sectionText, { color: theme.textSecondary }]}>
                      {selectedItem.materials_needed}
                    </Text>
                  </>
                ) : null}
              </ScrollView>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton, { borderColor: theme.error }]}
                onPress={() => {
                  if (selectedItem) handleReject(selectedItem);
                  closeDetails();
                }}
              >
                <Text style={[styles.actionText, { color: theme.error }]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton, { backgroundColor: theme.success }]}
                onPress={() => {
                  if (selectedItem) handleApprove(selectedItem);
                  closeDetails();
                }}
              >
                <Text style={[styles.actionText, { color: theme.onPrimary }]}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    actionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    viewButton: { backgroundColor: 'transparent' },
    rejectButton: { backgroundColor: 'transparent' },
    approveButton: { borderColor: 'transparent' },
    actionText: { fontSize: 13, fontWeight: '700' },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      borderRadius: 16,
      padding: 16,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalTitle: { fontSize: 16, fontWeight: '700' },
    modalBody: { maxHeight: 360 },
    modalHeading: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    modalMeta: { fontSize: 12, marginBottom: 4 },
    sectionLabel: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
    sectionText: { fontSize: 13, lineHeight: 18 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  });
