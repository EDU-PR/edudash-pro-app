/**
 * Parent Annual Calendar Screen
 * Displays school events, parent meetings, and excursions. Uses get_school_calendar_for_parent RPC.
 */
import React, { useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useSchoolCalendarForParent } from '@/hooks/useSchoolCalendar';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type CalendarItem =
  | { type: 'event'; id: string; title: string; date: string; subtype?: string }
  | { type: 'meeting'; id: string; title: string; date: string; time?: string }
  | { type: 'excursion'; id: string; title: string; date: string; destination?: string };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ParentAnnualCalendarScreen() {
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useSchoolCalendarForParent();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const items: CalendarItem[] = useMemo(() => {
    if (!data) return [];
    const list: CalendarItem[] = [];
    (data.events || []).forEach((e) =>
      list.push({ type: 'event', id: e.id, title: e.title, date: e.start_date, subtype: e.event_type })
    );
    (data.meetings || []).forEach((m) =>
      list.push({ type: 'meeting', id: m.id, title: m.title, date: m.meeting_date, time: m.start_time })
    );
    (data.excursions || []).forEach((x) =>
      list.push({ type: 'excursion', id: x.id, title: x.title, date: x.excursion_date, destination: x.destination })
    );
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [data]);

  const renderItem = ({ item }: { item: CalendarItem }) => {
    const icon = item.type === 'event' ? 'calendar' : item.type === 'meeting' ? 'people' : 'bus';
    const color = item.type === 'event' ? '#10B981' : item.type === 'meeting' ? '#8B5CF6' : '#F59E0B';
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon} size={20} color={color} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
        </View>
        <Text style={[styles.cardDate, { color: theme.textSecondary }]}>
          {formatDate(item.date)}
          {item.type === 'meeting' && item.time ? ` • ${item.time}` : ''}
          {item.type === 'excursion' && item.destination ? ` • ${item.destination}` : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <SubPageHeader
          title="Annual Calendar"
          subtitle="Events, meetings and excursions"
          onBack={() => router.back()}
        />
        {loading ? (
          <View style={styles.center}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="calendar-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No upcoming events</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Events, parent meetings and excursions will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={theme.primary} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: { background: string; card?: string; border?: string }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 14 },
    errorText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
    emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    list: { padding: 16, paddingBottom: 32 },
    card: {
      backgroundColor: theme.card ?? theme.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
    cardDate: { fontSize: 13, marginTop: 6, marginLeft: 30 },
  });
