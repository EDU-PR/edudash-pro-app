/**
 * Styles for Parent Progress Dashboard Screen
 * Extracted from parent-progress.tsx for WARP compliance
 */

import { StyleSheet } from 'react-native';

export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return '#10B981';
  if (percentage >= 60) return '#F59E0B';
  if (percentage >= 40) return '#3B82F6';
  return '#EF4444';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#10B981';
    case 'in_progress': return '#3B82F6';
    case 'overdue': return '#EF4444';
    default: return '#6B7280';
  }
}

export const createProgressStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  childSelector: {
    marginBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  childSelectorContent: {
    gap: 12,
  },
  childTab: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  childTabActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B98110',
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B98120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  childAvatarActive: {
    backgroundColor: '#10B981',
  },
  childAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  childName: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  childNameActive: {
    color: '#10B981',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  overviewCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  gradeBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  gradeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9731620',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F97316',
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  progressRingFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderRadius: 70,
  },
  progressRingInner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 60,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.text,
  },
  progressLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  starsSummaryRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  starsSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySectionText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  lessonItemBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  lessonStatus: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.text,
  },
  lessonMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  summaryStats: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  topSubjectsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  topSubjectsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  topSubjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectBadge: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  subjectBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  domainBreakdownContainer: {
    gap: 8,
  },
  domainItem: {
    gap: 4,
  },
  domainLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textTransform: 'capitalize',
  },
  domainMeta: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  domainBarTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: theme.border,
    overflow: 'hidden',
  },
  domainBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#5A409D',
  },
  feedbackContainer: {
    marginTop: 12,
    gap: 8,
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: theme.text,
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
  },
});
