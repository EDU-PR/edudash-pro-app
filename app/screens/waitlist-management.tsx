/**
 * Waitlist Management Screen
 *
 * Principals can view, manage, and prioritize waiting list entries.
 * Supports offering spots, tracking responses, and converting to enrolled students.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface WaitlistEntry {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string | null;
  parent_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  status: string;
  priority: number;
  position: number;
  preferred_start_date: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: '#3B82F6', label: 'Waiting' },
  offered: { color: '#F59E0B', label: 'Offered' },
  accepted: { color: '#10B981', label: 'Accepted' },
  declined: { color: '#EF4444', label: 'Declined' },
  expired: { color: '#6B7280', label: 'Expired' },
  enrolled: { color: '#8B5CF6', label: 'Enrolled' },
};

export default function WaitlistManagementScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = createStyles(theme);
  const organizationId = extractOrganizationId(profile);

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!organizationId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('school_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      setEntries((data as WaitlistEntry[]) || []);
    } catch (err) {
      logger.error('[Waitlist]', 'Failed to load entries', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, [fetchEntries]);

  const activeCount = entries.filter((e) => e.status === 'active').length;
  const offeredCount = entries.filter((e) => e.status === 'offered').length;

  const renderItem = ({ item }: { item: WaitlistEntry }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
    const age = item.child_date_of_birth
      ? Math.floor((Date.now() - new Date(item.child_date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.positionBadge}>
            <Text style={styles.positionText}>#{item.position}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${config.color}20` }]}>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <Text style={styles.childName}>{item.child_first_name} {item.child_last_name}</Text>
        {age !== null && <Text style={styles.detail}>Age: {age} years</Text>}
        <Text style={styles.detail}>👤 {item.parent_name}</Text>
        {item.parent_phone && <Text style={styles.detail}>📱 {item.parent_phone}</Text>}
        {item.preferred_start_date && (
          <Text style={styles.detail}>
            📅 Preferred: {new Date(item.preferred_start_date).toLocaleDateString()}
          </Text>
        )}
        {item.notes && <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>}

        {item.status === 'active' && (
          <TouchableOpacity style={[styles.offerBtn, { backgroundColor: theme.primary }]}>
            <Ionicons name="send" size={14} color="#fff" />
            <Text style={styles.offerBtnText}>Offer Spot</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <DesktopLayout role="principal" title="Waitlist">
        <Stack.Screen options={{ title: 'Waitlist', headerShown: false }} />
        <View style={styles.center}><EduDashSpinner /></View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="principal" title="Waitlist Management">
      <Stack.Screen options={{ title: 'Waitlist', headerShown: false }} />

      <View style={styles.container}>
        <Text style={styles.heading}>Waitlist</Text>
        <Text style={styles.subtitle}>
          {activeCount} waiting · {offeredCount} offered
        </Text>

        {/* Summary Bar */}
        <View style={styles.summaryRow}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = entries.filter((e) => e.status === key).length;
            if (count === 0) return null;
            return (
              <View key={key} style={[styles.summaryChip, { backgroundColor: `${cfg.color}15` }]}>
                <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
                <Text style={[styles.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No waitlist entries</Text>
              <Text style={styles.emptyHint}>Add children to the waiting list</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      </View>

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heading: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    summaryCount: { fontSize: 14, fontWeight: '700' },
    summaryLabel: { fontSize: 12, fontWeight: '600' },
    card: {
      backgroundColor: theme.cardBackground || theme.surface,
      borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    positionBadge: { backgroundColor: `${theme.primary}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    positionText: { fontSize: 12, fontWeight: '700', color: theme.primary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    statusText: { fontSize: 12, fontWeight: '700' },
    childName: { fontSize: 16, fontWeight: '600', color: theme.text },
    detail: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    notes: { fontSize: 13, color: theme.textSecondary, marginTop: 6, fontStyle: 'italic' },
    offerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginTop: 10,
    },
    offerBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 16, fontWeight: '600', color: theme.text, marginTop: 12 },
    emptyHint: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    fab: {
      position: 'absolute', right: 20, bottom: 28, width: 56, height: 56,
      borderRadius: 28, justifyContent: 'center', alignItems: 'center',
      elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2, shadowRadius: 5,
    },
  });
