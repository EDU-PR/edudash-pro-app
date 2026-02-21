/**
 * Parent / Teacher Menu Viewer Screen
 *
 * Read-only weekly menu view with:
 *  - Horizontal week picker (scrollable pill buttons)
 *  - Card grid: Mon–Fri showing Breakfast / Lunch / Snack
 *  - School selector for multi-school parents
 *  - Shared between parent and teacher roles (read-only for both)
 *
 * @filesize ≤500 lines (screens limit)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { SchoolMenuService } from '@/lib/services/schoolMenuService';
import type { WeeklyMenuDraft, WeeklyMenuDay } from '@/lib/services/schoolMenu.types';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { Card } from '@/components/ui/Card';

interface LinkedSchool {
  id: string;
  name: string;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatWeekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00.000Z`);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = DAY_NAMES[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1] || '';
  const short = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  return `${weekday}, ${short}`;
}

export default function ParentMenuScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [schools, setSchools] = useState<LinkedSchool[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(() =>
    SchoolMenuService.startOfWeekMonday(new Date()),
  );
  const [weekDraft, setWeekDraft] = useState<WeeklyMenuDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load linked schools
  useEffect(() => {
    if (!profile?.id && !user?.id) return;
    const loadSchools = async () => {
      try {
        const supabase = assertSupabase();
        const parentId = profile?.id || user?.id;
        const { data } = await supabase
          .from('students')
          .select('preschool_id, preschools:preschool_id(name)')
          .or(`parent_id.eq.${parentId},guardian_id.eq.${parentId}`);

        const mapped = new Map<string, string>();
        for (const row of data || []) {
          const id = (row as any).preschool_id as string | null;
          if (!id) continue;
          const schoolName = Array.isArray((row as any).preschools)
            ? (row as any).preschools[0]?.name
            : (row as any).preschools?.name;
          mapped.set(id, schoolName || 'My School');
        }

        // Also check org membership for teachers
        const { data: memberships } = await supabase
          .from('organization_members')
          .select('organization_id, organizations:organization_id(name)')
          .eq('user_id', parentId!)
          .in('role', ['teacher', 'admin', 'principal']);

        for (const row of memberships || []) {
          const id = (row as any).organization_id as string | null;
          if (!id || mapped.has(id)) continue;
          const orgName = Array.isArray((row as any).organizations)
            ? (row as any).organizations[0]?.name
            : (row as any).organizations?.name;
          mapped.set(id, orgName || 'My School');
        }

        const list = Array.from(mapped.entries()).map(([id, name]) => ({ id, name }));
        setSchools(list);
        if (list.length > 0) setSelectedSchool(list[0].id);
        else setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    void loadSchools();
  }, [profile?.id, user?.id]);

  // Load menu data
  const loadMenu = useCallback(async () => {
    if (!selectedSchool) {
      setLoading(false);
      return;
    }
    try {
      const [weeks, draft] = await Promise.all([
        SchoolMenuService.getAvailableWeeks(selectedSchool),
        SchoolMenuService.getWeekMenuWithFallback(selectedSchool, selectedWeek),
      ]);
      const merged = weeks.includes(selectedWeek)
        ? weeks
        : [selectedWeek, ...weeks];
      setAvailableWeeks(
        Array.from(new Set(merged)).sort((a, b) => b.localeCompare(a)),
      );
      setWeekDraft(draft);
    } catch {
      setWeekDraft(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSchool, selectedWeek]);

  useEffect(() => {
    if (!selectedSchool) return;
    setLoading(true);
    void loadMenu();
  }, [selectedSchool, selectedWeek, loadMenu]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadMenu();
  }, [loadMenu]);

  // ── Week pill render ──
  const renderWeekPill = useCallback(
    ({ item }: { item: string }) => {
      const active = item === selectedWeek;
      return (
        <TouchableOpacity
          style={[
            styles.weekPill,
            active && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => setSelectedWeek(item)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.weekPillText,
              active && { color: '#fff', fontWeight: '700' },
            ]}
          >
            {formatWeekLabel(item)}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedWeek, styles, theme.primary],
  );

  // ── Meal section ──
  const MealSection = ({ label, items, icon }: { label: string; items: string[]; icon: string }) => (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <Ionicons name={icon as any} size={14} color={theme.textSecondary} />
        <Text style={[styles.mealLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      {items.length > 0 ? (
        <View style={styles.mealChipRow}>
          {items.map((item, idx) => (
            <View key={idx} style={[styles.mealChip, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.mealChipText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.mealEmpty, { color: theme.textSecondary }]}>
          Not provided
        </Text>
      )}
    </View>
  );

  // ── Day card ──
  const renderDayCard = (day: WeeklyMenuDay) => {
    const isEmpty =
      day.breakfast.length === 0 &&
      day.lunch.length === 0 &&
      day.snack.length === 0;

    return (
      <Card key={day.date} margin={6} padding={16}>
        <View style={styles.dayHeader}>
          <Ionicons name="calendar-outline" size={16} color={theme.primary} />
          <Text style={[styles.dayTitle, { color: theme.text }]}>
            {formatDayLabel(day.date)}
          </Text>
        </View>
        {isEmpty ? (
          <Text style={[styles.emptyDay, { color: theme.textSecondary }]}>
            No meals listed for this day
          </Text>
        ) : (
          <View style={styles.mealsGrid}>
            <MealSection label="Breakfast" items={day.breakfast} icon="sunny-outline" />
            <MealSection label="Lunch" items={day.lunch} icon="restaurant-outline" />
            <MealSection label="Snack" items={day.snack} icon="cafe-outline" />
          </View>
        )}
        {day.notes && (
          <View style={[styles.notesBar, { backgroundColor: theme.primary + '10' }]}>
            <Ionicons name="chatbubble-outline" size={12} color={theme.primary} />
            <Text style={[styles.notesText, { color: theme.primary }]}>{day.notes}</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ title: 'Weekly Menu', headerBackTitle: 'Back' }} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="restaurant" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Weekly Menu</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            See what meals are planned for the week
          </Text>
        </View>

        {/* School selector (if multi-school) */}
        {schools.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.schoolPills}
          >
            {schools.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[
                  styles.schoolPill,
                  school.id === selectedSchool && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
                onPress={() => setSelectedSchool(school.id)}
              >
                <Text
                  style={[
                    styles.schoolPillText,
                    school.id === selectedSchool && { color: '#fff', fontWeight: '700' },
                  ]}
                >
                  {school.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Week picker */}
        {availableWeeks.length > 0 && (
          <View style={styles.weekPickerSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              Select Week
            </Text>
            <FlatList
              data={availableWeeks}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(w) => w}
              renderItem={renderWeekPill}
              contentContainerStyle={styles.weekPillRow}
            />
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.centerBox}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading menu...
            </Text>
          </View>
        ) : !selectedSchool ? (
          <Card margin={6} padding={30}>
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No School Linked</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Your account isn't linked to a school yet.
              </Text>
            </View>
          </Card>
        ) : !weekDraft ? (
          <Card margin={6} padding={30}>
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Menu Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                The school hasn't published a menu for this week yet.
              </Text>
            </View>
          </Card>
        ) : (
          weekDraft.days.map(renderDayCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ── */
const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 12, paddingBottom: 40 },
    header: { alignItems: 'center', marginBottom: 16, paddingTop: 8 },
    headerIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    headerSubtitle: { fontSize: 14, textAlign: 'center' },
    schoolPills: { paddingHorizontal: 4, paddingBottom: 12, gap: 8 },
    schoolPill: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    },
    schoolPillText: { fontSize: 14, color: theme.text },
    weekPickerSection: { marginBottom: 12 },
    sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
    weekPillRow: { paddingHorizontal: 4, gap: 8 },
    weekPill: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
      borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
    },
    weekPillText: { fontSize: 13, color: theme.textSecondary },
    dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    dayTitle: { fontSize: 16, fontWeight: '700' },
    mealsGrid: { gap: 10 },
    mealSection: { gap: 2 },
    mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    mealLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    mealChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    mealChip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    mealChipText: { fontSize: 13, fontWeight: '600' },
    mealEmpty: { fontSize: 13, fontStyle: 'italic', paddingLeft: 4 },
    notesBar: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    },
    notesText: { fontSize: 13, flex: 1 },
    emptyDay: { fontSize: 14, fontStyle: 'italic', paddingVertical: 8 },
    centerBox: { alignItems: 'center', paddingVertical: 40 },
    loadingText: { marginTop: 12, fontSize: 14 },
    emptyState: { alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
