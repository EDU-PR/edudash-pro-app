// Parent-visible Year Plan View
// Simplified view showing only parent-relevant info:
// term dates, holidays, excursions, events, and fundraisers.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { GeneratedYearPlan, GeneratedTerm, YearPlanMonthlyEntry } from './types';

interface ParentYearPlanViewProps {
  plan: GeneratedYearPlan;
  parentVisibleNotes?: string;
}

interface ParentMonthData {
  month: number;
  monthName: string;
  holidays: string[];
  excursions: Array<{ title: string; destination: string; date: string; cost: string }>;
  events: string[];
  fundraisers: string[];
  termInfo: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildParentData(plan: GeneratedYearPlan): ParentMonthData[] {
  const months: ParentMonthData[] = MONTH_NAMES.map((name, idx) => ({
    month: idx + 1,
    monthName: name,
    holidays: [],
    excursions: [],
    events: [],
    fundraisers: [],
    termInfo: null,
  }));

  // Term start/end info
  plan.terms.forEach((term) => {
    const startMonth = parseInt(term.startDate.slice(5, 7), 10);
    const endMonth = parseInt(term.endDate.slice(5, 7), 10);
    if (startMonth >= 1 && startMonth <= 12) {
      const existing = months[startMonth - 1].termInfo;
      months[startMonth - 1].termInfo = existing
        ? `${existing} | ${term.name} starts ${term.startDate}`
        : `${term.name} starts ${term.startDate}`;
    }
    if (endMonth >= 1 && endMonth <= 12 && endMonth !== startMonth) {
      const existing = months[endMonth - 1].termInfo;
      months[endMonth - 1].termInfo = existing
        ? `${existing} | ${term.name} ends ${term.endDate}`
        : `${term.name} ends ${term.endDate}`;
    }
  });

  // Monthly entries → holidays, fundraisers
  (plan.monthlyEntries || []).forEach((entry: YearPlanMonthlyEntry) => {
    const m = Math.min(12, Math.max(1, entry.monthIndex)) - 1;
    const label = entry.details ? `${entry.title}: ${entry.details}` : entry.title;
    if (entry.bucket === 'holidays_closures') {
      months[m].holidays.push(label);
    } else if (entry.bucket === 'donations_fundraisers') {
      months[m].fundraisers.push(label);
    }
  });

  // Excursions from terms
  plan.terms.forEach((term: GeneratedTerm) => {
    term.excursions.forEach((exc) => {
      const m = parseInt((exc.suggestedDate || term.startDate).slice(5, 7), 10);
      if (m >= 1 && m <= 12) {
        months[m - 1].excursions.push({
          title: exc.title,
          destination: exc.destination,
          date: exc.suggestedDate,
          cost: exc.estimatedCost,
        });
      }
    });
    // Special events
    term.specialEvents.forEach((event, idx) => {
      const startMonth = parseInt(term.startDate.slice(5, 7), 10);
      if (startMonth >= 1 && startMonth <= 12) {
        months[startMonth - 1].events.push(event);
      }
    });
  });

  return months.filter(
    (m) =>
      m.holidays.length > 0 ||
      m.excursions.length > 0 ||
      m.events.length > 0 ||
      m.fundraisers.length > 0 ||
      m.termInfo
  );
}

export function ParentYearPlanView({ plan, parentVisibleNotes }: ParentYearPlanViewProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const monthData = useMemo(() => buildParentData(plan), [plan]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Ionicons name="school-outline" size={28} color={theme.primary} />
        <Text style={styles.headerTitle}>Academic Year {plan.academicYear}</Text>
        <Text style={styles.headerSubtitle}>
          {plan.terms.length} Terms · Important Dates for Parents
        </Text>
      </View>

      {parentVisibleNotes ? (
        <View style={styles.notesCard}>
          <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
          <Text style={styles.notesText}>{parentVisibleNotes}</Text>
        </View>
      ) : null}

      {/* Term Quick Reference */}
      <View style={styles.termQuickRef}>
        <Text style={styles.sectionTitle}>Term Dates</Text>
        {plan.terms.map((term) => (
          <View key={term.termNumber} style={styles.termRow}>
            <View style={[styles.termDot, { backgroundColor: theme.primary }]} />
            <View style={styles.termRowContent}>
              <Text style={styles.termName}>{term.name}</Text>
              <Text style={styles.termDates}>
                {new Date(term.startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(term.endDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Month cards */}
      {monthData.map((m) => (
        <View key={m.month} style={styles.monthCard}>
          <Text style={styles.monthHeader}>{m.monthName}</Text>

          {m.termInfo && (
            <View style={styles.itemRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.primary} />
              <Text style={styles.itemText}>{m.termInfo}</Text>
            </View>
          )}

          {m.holidays.map((h, i) => (
            <View key={`h-${i}`} style={styles.itemRow}>
              <Text style={styles.flagEmoji}>🇿🇦</Text>
              <Text style={styles.holidayText}>{h}</Text>
            </View>
          ))}

          {m.excursions.map((exc, i) => (
            <View key={`e-${i}`} style={styles.excursionCard}>
              <View style={styles.excursionHeader}>
                <Ionicons name="bus-outline" size={16} color="#10B981" />
                <Text style={styles.excursionTitle}>{exc.title}</Text>
              </View>
              <Text style={styles.excursionDetail}>
                {exc.destination} · {exc.date}
              </Text>
              <View style={styles.costTag}>
                <Text style={styles.costText}>{exc.cost}</Text>
              </View>
            </View>
          ))}

          {m.events.map((ev, i) => (
            <View key={`ev-${i}`} style={styles.itemRow}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={styles.itemText}>{ev}</Text>
            </View>
          ))}

          {m.fundraisers.map((f, i) => (
            <View key={`f-${i}`} style={styles.itemRow}>
              <Text style={styles.flagEmoji}>💡</Text>
              <Text style={styles.fundraiserText}>{f}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },
    headerCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginTop: 8 },
    headerSubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
    notesCard: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: `${theme.primary}10`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
    },
    notesText: { flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 },
    termQuickRef: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 12 },
    termRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    termDot: { width: 10, height: 10, borderRadius: 5 },
    termRowContent: { flex: 1 },
    termName: { fontSize: 15, fontWeight: '600', color: theme.text },
    termDates: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    monthCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    monthHeader: { fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 12 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
    flagEmoji: { fontSize: 14, marginTop: 1 },
    itemText: { flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 },
    holidayText: { flex: 1, fontSize: 14, color: '#10B981', fontWeight: '500', lineHeight: 20 },
    fundraiserText: { flex: 1, fontSize: 14, color: '#F59E0B', fontWeight: '500', lineHeight: 20 },
    excursionCard: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    excursionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    excursionTitle: { fontSize: 15, fontWeight: '500', color: theme.text },
    excursionDetail: { fontSize: 13, color: theme.textSecondary, marginTop: 4, marginLeft: 22 },
    costTag: {
      alignSelf: 'flex-start',
      marginLeft: 22,
      marginTop: 6,
      backgroundColor: '#10B98120',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    costText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  });
