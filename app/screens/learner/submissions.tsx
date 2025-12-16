import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLearnerSubmissions } from '@/hooks/useLearnerData';

export default function LearnerSubmissionsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { data: submissions, isLoading, error } = useLearnerSubmissions();

  const groupedSubmissions = React.useMemo(() => {
    if (!submissions) return { draft: [], submitted: [], graded: [], returned: [] };
    
    return {
      draft: submissions.filter(s => s.status === 'draft'),
      submitted: submissions.filter(s => s.status === 'submitted'),
      graded: submissions.filter(s => s.status === 'graded'),
      returned: submissions.filter(s => s.status === 'returned'),
    };
  }, [submissions]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.submissions', { defaultValue: 'My Submissions' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {error && (
          <Card padding={20} margin={0}>
            <Text style={styles.errorText}>
              {t('common.error_loading', { defaultValue: 'Error loading submissions' })}
            </Text>
          </Card>
        )}

        {!isLoading && (!submissions || submissions.length === 0) && (
          <EmptyState
            icon="document-text-outline"
            title={t('learner.no_submissions', { defaultValue: 'No Submissions Yet' })}
            description={t('learner.submissions_prompt', { defaultValue: 'Your assignment submissions will appear here' })}
          />
        )}

        {/* Draft Submissions */}
        {groupedSubmissions.draft.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('learner.draft', { defaultValue: 'Draft' })} ({groupedSubmissions.draft.length})</Text>
            {groupedSubmissions.draft.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} theme={theme} t={t} />
            ))}
          </View>
        )}

        {/* Pending Review */}
        {groupedSubmissions.submitted.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('learner.pending_review', { defaultValue: 'Pending Review' })} ({groupedSubmissions.submitted.length})</Text>
            {groupedSubmissions.submitted.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} theme={theme} t={t} />
            ))}
          </View>
        )}

        {/* Graded */}
        {groupedSubmissions.graded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('learner.graded', { defaultValue: 'Graded' })} ({groupedSubmissions.graded.length})</Text>
            {groupedSubmissions.graded.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} theme={theme} t={t} />
            ))}
          </View>
        )}

        {/* Returned */}
        {groupedSubmissions.returned.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('learner.returned', { defaultValue: 'Returned' })} ({groupedSubmissions.returned.length})</Text>
            {groupedSubmissions.returned.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} theme={theme} t={t} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SubmissionCard({ submission, theme, t }: { submission: any; theme: any; t: any }) {
  const styles = createStyles(theme);

  return (
    <Card padding={16} margin={0} elevation="small" style={styles.submissionCard}>
      <TouchableOpacity
        onPress={() => router.push(`/screens/learner/submission-detail?id=${submission.id}`)}
      >
        <View style={styles.submissionHeader}>
          <View style={styles.submissionInfo}>
            <Text style={styles.submissionTitle}>{submission.assignment?.title || 'Assignment'}</Text>
            {submission.assignment?.due_date && (
              <Text style={styles.dueDate}>
                {t('learner.due', { defaultValue: 'Due' })}: {new Date(submission.assignment.due_date).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.status, theme) }]}>
            <Text style={styles.statusText}>{submission.status}</Text>
          </View>
        </View>
        {submission.feedback && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackLabel}>{t('learner.feedback', { defaultValue: 'Feedback' })}:</Text>
            <Text style={styles.feedbackText}>{submission.feedback}</Text>
          </View>
        )}
        {submission.grade && (
          <Text style={styles.grade}>
            {t('learner.grade', { defaultValue: 'Grade' })}: {submission.grade}
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={styles.date}>
            {submission.submitted_at
              ? `${t('learner.submitted_on', { defaultValue: 'Submitted' })}: ${new Date(submission.submitted_at).toLocaleDateString()}`
              : `${t('learner.last_updated', { defaultValue: 'Last updated' })}: ${new Date(submission.created_at).toLocaleDateString()}`
            }
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>
    </Card>
  );
}

function getStatusColor(status: string, theme: any): string {
  switch (status) {
    case 'draft':
      return theme.textSecondary;
    case 'submitted':
      return theme.warning || '#F59E0B';
    case 'graded':
      return theme.success || '#10B981';
    case 'returned':
      return theme.error || '#EF4444';
    default:
      return theme.border;
  }
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, paddingBottom: 32 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  section: { marginBottom: 24 },
  sectionTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  submissionCard: { marginBottom: 12 },
  submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  submissionInfo: { flex: 1 },
  submissionTitle: { color: theme?.text || '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  dueDate: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  feedbackContainer: { marginTop: 8, padding: 12, backgroundColor: theme?.surface, borderRadius: 8 },
  feedbackLabel: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, marginBottom: 4 },
  feedbackText: { color: theme?.text || '#fff', fontSize: 14 },
  grade: { color: theme?.primary, fontSize: 14, fontWeight: '600', marginTop: 8 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  date: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12 },
  errorText: { color: theme?.error || '#EF4444', textAlign: 'center' },
});

