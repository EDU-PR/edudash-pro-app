// Generated Year Plan View Component
// Displays the AI-generated year plan overview

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GeneratedYearPlan, YearPlanMonthlyBucket } from './types';
import { TermCard } from './TermCard';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface GeneratedPlanViewProps {
  plan: GeneratedYearPlan;
  expandedTerm: number | null;
  isSaving: boolean;
  onToggleExpandTerm: (termNumber: number | null) => void;
  onSave: () => void;
  onRegenerate: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BUCKET_ORDER: YearPlanMonthlyBucket[] = [
  'holidays_closures',
  'meetings_admin',
  'excursions_extras',
  'donations_fundraisers',
];
const BUCKET_LABELS: Record<YearPlanMonthlyBucket, string> = {
  holidays_closures: 'Holidays & Closures',
  meetings_admin: 'Meetings & Admin',
  excursions_extras: 'Excursions & Extras',
  donations_fundraisers: 'Donations & Fundraisers',
};

export function GeneratedPlanView({
  plan,
  expandedTerm,
  isSaving,
  onToggleExpandTerm,
  onSave,
  onRegenerate,
}: GeneratedPlanViewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);
  const [mode, setMode] = useState<'terms' | 'monthly'>('monthly');

  const monthlyByMonth = useMemo(() => {
    const map = new Map<number, Record<YearPlanMonthlyBucket, string[]>>();
    for (let i = 1; i <= 12; i += 1) {
      map.set(i, {
        holidays_closures: [],
        meetings_admin: [],
        excursions_extras: [],
        donations_fundraisers: [],
      });
    }

    (plan.monthlyEntries || []).forEach((entry) => {
      const month = Math.min(12, Math.max(1, Number(entry.monthIndex) || 1));
      const target = map.get(month);
      if (!target) return;
      const label = entry.details ? `${entry.title}: ${entry.details}` : entry.title;
      target[entry.bucket].push(label);
    });

    return map;
  }, [plan.monthlyEntries]);

  return (
    <ScrollView style={styles.planContainer} contentContainerStyle={styles.planContent}>
      {/* Plan Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>Academic Year {plan.academicYear}</Text>
        <Text style={styles.overviewVision}>{plan.schoolVision}</Text>
        
        <View style={styles.overviewStats}>
          <View style={styles.overviewStat}>
            <Text style={styles.statValue}>{plan.terms.length}</Text>
            <Text style={styles.statLabel}>Terms</Text>
          </View>
          <View style={styles.overviewStat}>
            <Text style={styles.statValue}>
              {plan.terms.reduce((acc, t) => acc + t.weeklyThemes.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Themes</Text>
          </View>
          <View style={styles.overviewStat}>
            <Text style={styles.statValue}>
              {plan.terms.reduce((acc, t) => acc + t.excursions.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Excursions</Text>
          </View>
        </View>
        
        <View style={styles.budgetRow}>
          <Ionicons name="wallet-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.budgetText}>Estimated Budget: {plan.budgetEstimate}</Text>
        </View>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'monthly' && styles.modeBtnActive]}
          onPress={() => setMode('monthly')}
        >
          <Text style={[styles.modeBtnText, mode === 'monthly' && styles.modeBtnTextActive]}>Month Matrix</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'terms' && styles.modeBtnActive]}
          onPress={() => setMode('terms')}
        >
          <Text style={[styles.modeBtnText, mode === 'terms' && styles.modeBtnTextActive]}>Term Details</Text>
        </TouchableOpacity>
      </View>
      
      {/* Annual Goals */}
      <View style={styles.goalsCard}>
        <Text style={styles.goalsTitle}>Annual Goals</Text>
        {plan.annualGoals.map((goal, idx) => (
          <View key={idx} style={styles.goalItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.goalText}>{goal}</Text>
          </View>
        ))}
      </View>

      {mode === 'monthly' ? (
        <>
          <Text style={styles.termsHeader}>{plan.academicYear} Month Matrix Preview</Text>
          <View style={styles.monthlyGrid}>
            {Array.from({ length: 12 }, (_, idx) => {
              const month = idx + 1;
              const grouped = monthlyByMonth.get(month)!;
              return (
                <View key={month} style={styles.monthCard}>
                  <Text style={styles.monthTitle}>{MONTH_NAMES[idx]}</Text>
                  {BUCKET_ORDER.map((bucket) => (
                    <View key={bucket} style={styles.monthBucket}>
                      <Text style={styles.monthBucketLabel}>{BUCKET_LABELS[bucket]}</Text>
                      {(grouped[bucket].length > 0 ? grouped[bucket] : ['—']).slice(0, 2).map((item, itemIndex) => (
                        <Text key={`${bucket}-${itemIndex}`} style={styles.monthItem}>• {item}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>

          <View style={styles.goalsCard}>
            <Text style={styles.goalsTitle}>Operational Highlights</Text>
            {(plan.operationalHighlights || []).slice(0, 6).map((highlight, idx) => (
              <View key={idx} style={styles.goalItem}>
                <Ionicons name="flash" size={18} color="#8B5CF6" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalText}>{highlight.title}</Text>
                  <Text style={styles.monthItem}>{highlight.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.termsHeader}>Term Details</Text>
          {plan.terms.map((term) => (
            <TermCard
              key={term.termNumber}
              term={term}
              isExpanded={expandedTerm === term.termNumber}
              onToggleExpand={() => onToggleExpandTerm(
                expandedTerm === term.termNumber ? null : term.termNumber
              )}
            />
          ))}
        </>
      )}
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <EduDashSpinner size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Save to Database</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
          onPress={onRegenerate}
        >
          <Ionicons name="refresh" size={20} color={theme.text} />
          <Text style={[styles.actionButtonText, { color: theme.text }]}>Regenerate</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any, insetBottom: number) =>
  StyleSheet.create({
    planContainer: {
      flex: 1,
    },
    planContent: {
      padding: 16,
      paddingBottom: insetBottom + 24,
    },
    overviewCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    overviewTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
    },
    overviewVision: {
      fontSize: 15,
      color: theme.textSecondary,
      fontStyle: 'italic',
      lineHeight: 22,
      marginBottom: 16,
    },
    overviewStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    overviewStat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    modeBtn: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    modeBtnActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    modeBtnText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 13,
    },
    modeBtnTextActive: {
      color: theme.primary,
    },
    goalsCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    goalsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    goalItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    goalText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    termsHeader: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
      marginTop: 8,
    },
    monthlyGrid: {
      gap: 10,
      marginBottom: 14,
    },
    monthCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
      gap: 8,
    },
    monthTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    monthBucket: {
      gap: 2,
    },
    monthBucketLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    monthItem: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
  });
