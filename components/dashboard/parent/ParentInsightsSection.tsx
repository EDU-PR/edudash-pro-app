/**
 * ParentInsightsSection
 *
 * Dashboard section that renders ProactiveInsight cards for the active child.
 * Renders inside a CollapsibleSection; kept lightweight to stay WARP-compliant.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ParentInsightsCard } from '@/components/parent/ParentInsightsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ProactiveInsight, PredictiveAlert } from '@/services/ProactiveInsightsService';
import type { TempLessonSuggestion } from '@/lib/services/parentTempLessonService';
import { Ionicons } from '@expo/vector-icons';

interface ParentInsightsSectionProps {
  insights: ProactiveInsight[];
  alerts: PredictiveAlert[];
  loading: boolean;
  error: string | null;
  tempLessonSuggestions?: TempLessonSuggestion[];
  tempLessonSuggestionsLoading?: boolean;
  tempLessonSuggestionsError?: string | null;
  canUseTempLessons?: boolean;
  creatingTempLessonId?: string | null;
  onCreateTempLesson?: (suggestion: TempLessonSuggestion) => void;
  onActionPress?: (actionTitle: string) => void;
}

export function ParentInsightsSection({
  insights,
  alerts,
  loading,
  error,
  tempLessonSuggestions = [],
  tempLessonSuggestionsLoading = false,
  tempLessonSuggestionsError = null,
  canUseTempLessons = false,
  creatingTempLessonId = null,
  onCreateTempLesson,
  onActionPress,
}: ParentInsightsSectionProps) {
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Analyzing progress...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={20} color={theme.error || '#EF4444'} />
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          Unable to load insights
        </Text>
      </View>
    );
  }

  const hasContent = insights.length > 0 || alerts.length > 0;

  if (!hasContent) {
    return (
      <EmptyState
        icon="sparkles-outline"
        title="No insights yet"
        description="Insights will appear as your child's learning data accumulates."
        size="small"
        secondary
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Predictive Alerts (urgent first) */}
      {alerts.length > 0 && (
        <View style={styles.alertsSection}>
          {alerts.map((alert) => (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                {
                  backgroundColor:
                    alert.severity === 'urgent'
                      ? (theme.errorLight || '#FEE2E2')
                      : alert.severity === 'warning'
                        ? (theme.warningLight || '#FEF3C7')
                        : (theme.cardSecondary || '#F3F4F6'),
                  borderLeftColor:
                    alert.severity === 'urgent'
                      ? '#EF4444'
                      : alert.severity === 'warning'
                        ? '#F59E0B'
                        : theme.primary,
                },
              ]}
            >
              <Ionicons
                name={
                  alert.alert_type === 'assessment_coming'
                    ? 'school'
                    : alert.alert_type === 'homework_due'
                      ? 'document-text'
                      : 'notifications'
                }
                size={18}
                color={
                  alert.severity === 'urgent'
                    ? '#EF4444'
                    : alert.severity === 'warning'
                      ? '#F59E0B'
                      : theme.primary
                }
              />
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: theme.text }]}>
                  {alert.title}
                </Text>
                <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                  {alert.message}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {canUseTempLessons && (
        <View style={styles.tempSection}>
          <View style={styles.tempHeader}>
            <Ionicons name="flash-outline" size={16} color={theme.primary} />
            <Text style={[styles.tempTitle, { color: theme.text }]}>
              Suggested Temporary Lessons (7 days)
            </Text>
          </View>

          {tempLessonSuggestionsLoading ? (
            <View style={styles.tempLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.tempLoadingText, { color: theme.textSecondary }]}>
                Preparing personalized suggestions...
              </Text>
            </View>
          ) : tempLessonSuggestionsError ? (
            <Text style={[styles.tempErrorText, { color: theme.textSecondary }]}>
              {tempLessonSuggestionsError}
            </Text>
          ) : tempLessonSuggestions.length === 0 ? (
            <Text style={[styles.tempEmptyText, { color: theme.textSecondary }]}>
              Suggestions will appear as Dash learns your child&apos;s needs.
            </Text>
          ) : (
            tempLessonSuggestions.map((suggestion) => {
              const creating = creatingTempLessonId === suggestion.id;
              return (
                <View
                  key={suggestion.id}
                  style={[
                    styles.tempCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.tempCardHeader}>
                    <Text style={[styles.tempCardTitle, { color: theme.text }]}>{suggestion.title}</Text>
                    <View style={styles.tempBadge}>
                      <Text style={styles.tempBadgeText}>{suggestion.difficulty}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tempCardReason, { color: theme.textSecondary }]}>
                    {suggestion.reason}
                  </Text>
                  <View style={styles.tempMetaRow}>
                    <Text style={[styles.tempMetaText, { color: theme.textSecondary }]}>
                      {suggestion.domain.replace('_', ' ')}
                    </Text>
                    <Text style={[styles.tempMetaText, { color: theme.textSecondary }]}>
                      {suggestion.estimatedDurationMinutes} min
                    </Text>
                  </View>
                  {onCreateTempLesson && (
                    <TouchableOpacity
                      onPress={() => onCreateTempLesson(suggestion)}
                      disabled={creating}
                      style={[
                        styles.tempButton,
                        { backgroundColor: creating ? theme.surface : theme.primary },
                      ]}
                    >
                      <Text style={styles.tempButtonText}>
                        {creating ? 'Creating...' : 'Create temporary lesson'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Proactive Insight Cards */}
      {insights.map((insight) => (
        <ParentInsightsCard
          key={insight.id}
          insight={insight}
          onActionPress={onActionPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  tempSection: {
    gap: 8,
    marginBottom: 8,
  },
  tempHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  tempTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tempLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  tempLoadingText: {
    fontSize: 13,
  },
  tempErrorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tempEmptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tempCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  tempCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tempCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  tempBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#2563EB22',
  },
  tempBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  tempCardReason: {
    fontSize: 13,
    lineHeight: 18,
  },
  tempMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempMetaText: {
    fontSize: 12,
  },
  tempButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
  },
  alertsSection: {
    gap: 8,
    marginBottom: 8,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    gap: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
});
