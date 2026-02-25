// Planning Insights Panel for AI Year Planner
// Shows computed analytics about term balance, meeting distribution, etc.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { GeneratedYearPlan } from './types';

interface PlanInsightsPanelProps {
  plan: GeneratedYearPlan;
}

interface InsightItem {
  label: string;
  detail: string;
  status: 'good' | 'attention';
}

function computeInsights(plan: GeneratedYearPlan): InsightItem[] {
  const insights: InsightItem[] = [];
  const { terms, monthlyEntries } = plan;

  // Term balance
  const weekCounts = terms.map((t) => t.weeklyThemes.length);
  const minWeeks = Math.min(...weekCounts);
  const maxWeeks = Math.max(...weekCounts);
  if (maxWeeks - minWeeks <= 2) {
    insights.push({
      label: 'Term Balance',
      detail: `Terms are evenly balanced (${minWeeks}–${maxWeeks} weeks each)`,
      status: 'good',
    });
  } else {
    const heaviest = terms.reduce((a, b) =>
      a.weeklyThemes.length > b.weeklyThemes.length ? a : b
    );
    insights.push({
      label: 'Term Balance',
      detail: `Term ${heaviest.termNumber} is ${heaviest.weeklyThemes.length} weeks — consider splitting`,
      status: 'attention',
    });
  }

  // Meeting distribution
  const termsMissingMeetings = terms.filter((t) => t.meetings.length === 0);
  if (termsMissingMeetings.length === 0) {
    insights.push({
      label: 'Meeting Distribution',
      detail: 'Meetings spread across all terms',
      status: 'good',
    });
  } else {
    const missing = termsMissingMeetings.map((t) => `Term ${t.termNumber}`).join(', ');
    insights.push({
      label: 'Meeting Distribution',
      detail: `No meetings in ${missing}`,
      status: 'attention',
    });
  }

  // Excursion budget estimate
  const totalExcursions = terms.reduce((acc, t) => acc + t.excursions.length, 0);
  const costValues = terms
    .flatMap((t) => t.excursions)
    .map((e) => {
      const n = Number.parseFloat(String(e.estimatedCost || '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    });
  const totalCost = costValues.reduce((a, b) => a + b, 0);
  if (totalExcursions > 0) {
    insights.push({
      label: 'Excursion Budget',
      detail: `Estimated excursion budget: R${totalCost.toLocaleString()} (${totalExcursions} excursion${totalExcursions !== 1 ? 's' : ''})`,
      status: 'good',
    });
  }

  // Coverage gaps — check if every month has at least one entry
  const monthsWithEntries = new Set(
    (monthlyEntries || []).map((e) => e.monthIndex)
  );
  const emptyMonths: number[] = [];
  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = 1; m <= 12; m++) {
    if (!monthsWithEntries.has(m)) emptyMonths.push(m);
  }
  if (emptyMonths.length === 0) {
    insights.push({
      label: 'Activity Coverage',
      detail: 'All months have at least one planned activity',
      status: 'good',
    });
  } else {
    const names = emptyMonths.map((m) => MONTH_NAMES_SHORT[m - 1]).join(', ');
    insights.push({
      label: 'Activity Coverage',
      detail: `No activities in ${names}`,
      status: 'attention',
    });
  }

  // Special events distribution
  const totalEvents = terms.reduce((acc, t) => acc + t.specialEvents.length, 0);
  if (totalEvents > 0) {
    insights.push({
      label: 'Special Events',
      detail: `${totalEvents} special event${totalEvents !== 1 ? 's' : ''} planned across the year`,
      status: 'good',
    });
  }

  return insights;
}

export function PlanInsightsPanel({ plan }: PlanInsightsPanelProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insights = useMemo(() => computeInsights(plan), [plan]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="bar-chart-outline" size={20} color={theme.primary} />
        <Text style={styles.headerText}>Planning Insights</Text>
      </View>

      {insights.map((item, idx) => (
        <View
          key={idx}
          style={[styles.insightRow, idx % 2 === 1 && styles.insightRowAlt]}
        >
          <Text style={styles.statusIcon}>
            {item.status === 'good' ? '✓' : '⚠️'}
          </Text>
          <View style={styles.insightContent}>
            <Text style={styles.insightLabel}>{item.label}</Text>
            <Text
              style={[
                styles.insightDetail,
                item.status === 'good'
                  ? styles.insightDetailGood
                  : styles.insightDetailAttention,
              ]}
            >
              {item.detail}
            </Text>
          </View>
        </View>
      ))}

      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {plan.terms.reduce((a, t) => a + t.weeklyThemes.length, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Weeks</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {plan.terms.reduce((a, t) => a + t.excursions.length, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Excursions</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {plan.terms.reduce((a, t) => a + t.meetings.length, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Meetings</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {plan.terms.reduce((a, t) => a + t.specialEvents.length, 0)}
          </Text>
          <Text style={styles.summaryLabel}>Events</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    headerText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 10,
      borderRadius: 8,
      marginBottom: 4,
    },
    insightRowAlt: {
      backgroundColor: `${theme.background}80`,
    },
    statusIcon: {
      fontSize: 16,
      marginTop: 2,
    },
    insightContent: {
      flex: 1,
    },
    insightLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    insightDetail: {
      fontSize: 13,
      lineHeight: 18,
    },
    insightDetailGood: {
      color: '#10B981',
    },
    insightDetailAttention: {
      color: '#F59E0B',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 16,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    summaryItem: {
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.primary,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
