// Generated Year Plan View Component
// Displays the AI-generated year plan overview

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GeneratedYearPlan } from './types';
import { TermCard } from './TermCard';

interface GeneratedPlanViewProps {
  plan: GeneratedYearPlan;
  expandedTerm: number | null;
  isSaving: boolean;
  onToggleExpandTerm: (termNumber: number | null) => void;
  onSave: () => void;
  onRegenerate: () => void;
}

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
      
      {/* Terms */}
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
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
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
