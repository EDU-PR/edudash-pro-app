/**
 * Timetable Management Screen
 *
 * Principals can view and manage weekly class timetables.
 * Shows a day-of-week tabbed view with time slots.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

interface TimetableSlot {
  id: string;
  class_id: string | null;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  activity_type: string;
  room: string | null;
  notes: string | null;
  class_name?: string;
  teacher_name?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri

export default function TimetableManagementScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = createStyles(theme);
  const organizationId = extractOrganizationId(profile);

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1);

  const fetchSlots = useCallback(async () => {
    if (!organizationId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('*')
        .eq('school_id', organizationId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSlots((data as TimetableSlot[]) || []);
    } catch (err) {
      logger.error('[Timetable]', 'Failed to load slots', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSlots();
  }, [fetchSlots]);

  const daySlots = slots.filter((s) => s.day_of_week === selectedDay);

  if (loading) {
    return (
      <DesktopLayout role="principal" title="Timetable">
        <Stack.Screen options={{ title: 'Timetable', headerShown: false }} />
        <View style={styles.center}><EduDashSpinner /></View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="principal" title="Timetable Management">
      <Stack.Screen options={{ title: 'Timetable', headerShown: false }} />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.heading}>Weekly Timetable</Text>
        <Text style={styles.subtitle}>Manage class schedules and teacher assignments</Text>

        {/* Day Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
          {WEEKDAYS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, selectedDay === day && styles.dayTabActive]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayTabText, selectedDay === day && styles.dayTabTextActive]}>
                {DAYS[day]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Slots for Selected Day */}
        {daySlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No classes scheduled for {DAYS[selectedDay]}</Text>
            <Text style={styles.emptyHint}>Tap + to add a timetable slot</Text>
          </View>
        ) : (
          daySlots.map((slot) => (
            <View key={slot.id} style={styles.slotCard}>
              <View style={styles.slotTime}>
                <Text style={styles.timeText}>{slot.start_time?.slice(0, 5)}</Text>
                <Text style={styles.timeSeparator}>–</Text>
                <Text style={styles.timeText}>{slot.end_time?.slice(0, 5)}</Text>
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotSubject}>{slot.subject || slot.activity_type}</Text>
                {slot.room && <Text style={styles.slotDetail}>📍 {slot.room}</Text>}
                {slot.teacher_name && <Text style={styles.slotDetail}>👩‍🏫 {slot.teacher_name}</Text>}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
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
    subtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
    dayTabs: { flexDirection: 'row', marginBottom: 16 },
    dayTab: {
      paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999,
      backgroundColor: theme.cardBackground || theme.surface,
      marginRight: 8, borderWidth: 1, borderColor: theme.border,
    },
    dayTabActive: { backgroundColor: `${theme.primary}15`, borderColor: theme.primary },
    dayTabText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
    dayTabTextActive: { color: theme.primary },
    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 16, fontWeight: '600', color: theme.text, marginTop: 12 },
    emptyHint: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    slotCard: {
      flexDirection: 'row', backgroundColor: theme.cardBackground || theme.surface,
      borderRadius: 12, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border,
    },
    slotTime: { width: 70, alignItems: 'center', justifyContent: 'center' },
    timeText: { fontSize: 13, fontWeight: '700', color: theme.primary },
    timeSeparator: { fontSize: 11, color: theme.textSecondary },
    slotInfo: { flex: 1, marginLeft: 12 },
    slotSubject: { fontSize: 15, fontWeight: '600', color: theme.text },
    slotDetail: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    fab: {
      position: 'absolute', right: 20, bottom: 28, width: 56, height: 56,
      borderRadius: 28, justifyContent: 'center', alignItems: 'center',
      elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2, shadowRadius: 5,
    },
  });
