/**
 * ParentDashboardContentSections — Extracted collapsible sections.
 *
 * Contains: Uniform Sizes, Live Classes, Teacher Notes, Progress,
 * AI Insights, Birthdays, Today's Activities.
 *
 * Extracted per WARP (components ≤400 lines).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';

import { CollapsibleSection, GlowContainer, type SectionAttention } from '../shared';
import { DailyActivityFeed, TeacherQuickNotes, ChildProgressBadges, UniformSizesSection } from '../parent';
import { JoinLiveLesson } from '@/components/calls/JoinLiveLesson';
import { OnboardingHint } from '@/components/ui/OnboardingHint';
import { EmptyState } from '@/components/ui/EmptyState';
import { UpcomingBirthdaysCard } from '../UpcomingBirthdaysCard';
import { ParentInsightsSection } from '../parent/ParentInsightsSection';
import type { ProactiveInsight, PredictiveAlert } from '@/services/ProactiveInsightsService';
import type { TempLessonSuggestion } from '@/lib/services/parentTempLessonService';

interface BirthdayData {
  today: any[];
  thisWeek: any[];
  thisMonth: any[];
  nextMonth: any[];
}

export interface ParentDashboardContentSectionsProps {
  // Children + active
  activeChildId: string | null;
  children: any[];
  uniformEnabled: boolean;
  uniformSchoolIds: string[];
  hasOrganization: boolean;
  preschoolId?: string | null;
  // Dashboard data
  dashboardData: any;
  // Section state
  collapsedSections: Set<string>;
  toggleSection: (sectionId: string, isCollapsed?: boolean) => void;
  sectionAttention: Record<string, SectionAttention | undefined>;
  // Live classes hint
  showLiveClassesHint: boolean;
  dismissLiveClassesHint: () => void;
  showQuickActionsHint: boolean;
  // Insights
  parentInsights: ProactiveInsight[];
  parentAlerts: PredictiveAlert[];
  insightsLoading: boolean;
  insightsError: string | null;
  hasUrgentInsights: boolean;
  tempLessonSuggestions?: TempLessonSuggestion[];
  tempLessonSuggestionsLoading?: boolean;
  tempLessonSuggestionsError?: string | null;
  canUseTempLessons?: boolean;
  creatingTempLessonId?: string | null;
  onCreateTempLesson?: (suggestion: TempLessonSuggestion) => void;
  // Birthdays
  upcomingBirthdays: BirthdayData | null;
  birthdaysLoading: boolean;
}

export const ParentDashboardContentSections: React.FC<ParentDashboardContentSectionsProps> = ({
  activeChildId,
  children,
  uniformEnabled,
  uniformSchoolIds,
  hasOrganization,
  preschoolId,
  dashboardData,
  collapsedSections,
  toggleSection,
  sectionAttention,
  showLiveClassesHint,
  dismissLiveClassesHint,
  showQuickActionsHint,
  parentInsights,
  parentAlerts,
  insightsLoading,
  insightsError,
  hasUrgentInsights,
  tempLessonSuggestions = [],
  tempLessonSuggestionsLoading = false,
  tempLessonSuggestionsError = null,
  canUseTempLessons = false,
  creatingTempLessonId,
  onCreateTempLesson,
  upcomingBirthdays,
  birthdaysLoading,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Uniform Sizes (enabled by school) */}
      {hasOrganization && children.length > 0 && uniformEnabled && (
        <CollapsibleSection
          title={t('dashboard.uniform_sizes', { defaultValue: 'Uniform Sizes' })}
          sectionId="uniform-sizes"
          icon="shirt-outline"
          hint={t('dashboard.hints.uniform_sizes', { defaultValue: 'View sizes and uniform notes per child.' })}
          defaultCollapsed={collapsedSections.has('uniform-sizes')}
          onToggle={toggleSection}
        >
          <UniformSizesSection
            children={children.filter((child) =>
              (child.preschoolId || child.preschool_id)
                ? uniformSchoolIds.includes(child.preschoolId || child.preschool_id)
                : false
            )}
          />
        </CollapsibleSection>
      )}

      {/* Live Classes */}
      <CollapsibleSection
        title={t('calls.live_classes', { defaultValue: 'Live Classes' })}
        sectionId="live-classes"
        icon="videocam"
        hint={t('dashboard.hints.live_classes', { defaultValue: 'Join live lessons and events when they start.' })}
        defaultCollapsed={collapsedSections.has('live-classes')}
        onToggle={toggleSection}
        attention={sectionAttention['live-classes']}
      >
        {showLiveClassesHint && !showQuickActionsHint && (
          <OnboardingHint
            hintId="parent_live_classes"
            message={t('hints.live_classes_message', { defaultValue: "When your child's teacher starts a live class, you'll see it here. Tap to join and watch together!" })}
            icon="videocam"
            position="bottom"
            screen="parent_dashboard"
            onDismiss={dismissLiveClassesHint}
          />
        )}
        {preschoolId ? (
          <JoinLiveLesson preschoolId={preschoolId} />
        ) : (
          <EmptyState
            icon="videocam-outline"
            title={t('dashboard.parent.empty.live_classes.title', { defaultValue: 'Live classes preview' })}
            description={t('dashboard.parent.empty.live_classes.description', {
              defaultValue: 'Live class links appear here once a child is linked to a school.',
            })}
            actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
            onActionPress={() => router.push('/screens/parent-child-registration' as any)}
            size="small"
            secondary
          />
        )}
      </CollapsibleSection>

      {/* Teacher Quick Notes */}
      <CollapsibleSection
        title={t('dashboard.parent.section.teacher_notes', { defaultValue: 'Teacher Notes' })}
        sectionId="teacher-notes"
        icon="chatbubbles"
        hint={t('dashboard.hints.teacher_notes', { defaultValue: 'Latest feedback and notes from educators.' })}
        defaultCollapsed={collapsedSections.has('teacher-notes')}
        onToggle={toggleSection}
        attention={sectionAttention['teacher-notes']}
      >
        {activeChildId ? (
          <TeacherQuickNotes studentId={activeChildId} maxItems={3} showHeader={false} />
        ) : (
          <EmptyState
            icon="chatbubbles-outline"
            title={t('dashboard.parent.empty.teacher_notes.title', { defaultValue: 'Teacher notes preview' })}
            description={t('dashboard.parent.empty.teacher_notes.description', {
              defaultValue: 'Notes from educators will appear here after a child is linked.',
            })}
            actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
            onActionPress={() => router.push('/screens/parent-child-registration' as any)}
            size="small"
            secondary
          />
        )}
      </CollapsibleSection>

      {/* Child Progress & Achievements */}
      <CollapsibleSection
        title={t('dashboard.parent.section.progress', { defaultValue: 'Progress & Achievements' })}
        sectionId="progress"
        icon="ribbon"
        hint={t('dashboard.hints.progress', { defaultValue: 'Badges, milestones, and growth snapshots.' })}
        defaultCollapsed={collapsedSections.has('progress')}
        onToggle={toggleSection}
      >
        {activeChildId ? (
          <ChildProgressBadges studentId={activeChildId} compact={false} showHeader={false} />
        ) : (
          <EmptyState
            icon="ribbon-outline"
            title={t('dashboard.parent.empty.progress.title', { defaultValue: 'Progress badges preview' })}
            description={t('dashboard.parent.empty.progress.description', {
              defaultValue: 'Track milestones and achievements once a child is linked.',
            })}
            actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
            onActionPress={() => router.push('/screens/parent-child-registration' as any)}
            size="small"
            secondary
          />
        )}
      </CollapsibleSection>

      {/* AI Insights & Alerts */}
      <GlowContainer urgency={hasUrgentInsights ? 'important' : 'none'} elevated={hasUrgentInsights}>
        <CollapsibleSection
          title={t('dashboard.parent.section.insights', { defaultValue: 'AI Insights' })}
          sectionId="insights"
          icon="sparkles"
          hint={t('dashboard.hints.insights', { defaultValue: "AI-powered observations about your child's progress." })}
          defaultCollapsed={collapsedSections.has('insights')}
          onToggle={toggleSection}
        >
          <ParentInsightsSection
            insights={parentInsights}
            alerts={parentAlerts}
            loading={insightsLoading}
            error={insightsError}
            tempLessonSuggestions={tempLessonSuggestions}
            tempLessonSuggestionsLoading={tempLessonSuggestionsLoading}
            tempLessonSuggestionsError={tempLessonSuggestionsError}
            canUseTempLessons={canUseTempLessons}
            creatingTempLessonId={creatingTempLessonId}
            onCreateTempLesson={onCreateTempLesson}
            onActionPress={(action) => {
              track('parent.insight.action_pressed', { action });
            }}
          />
        </CollapsibleSection>
      </GlowContainer>

      {/* Upcoming Birthdays */}
      <CollapsibleSection
        title={t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays 🎂' })}
        sectionId="birthdays"
        icon="🎈"
        hint={t('dashboard.hints.birthdays', { defaultValue: 'Upcoming class birthdays and reminders.' })}
        defaultCollapsed={collapsedSections.has('birthdays')}
        onToggle={toggleSection}
        attention={sectionAttention['birthdays']}
        actionLabel={t('dashboard.view_chart', { defaultValue: 'View Chart' })}
        onActionPress={() => router.push('/screens/birthday-chart' as any)}
      >
        {preschoolId ? (
          <UpcomingBirthdaysCard
            birthdays={upcomingBirthdays}
            loading={birthdaysLoading}
            showHeader={false}
            maxItems={4}
            compact={true}
            studentTapBehavior="none"
            onViewAll={() => router.push('/screens/birthday-chart' as any)}
          />
        ) : (
          <EmptyState
            icon="balloon-outline"
            title={t('dashboard.parent.empty.birthdays.title', { defaultValue: 'Upcoming birthdays preview' })}
            description={t('dashboard.parent.empty.birthdays.description', {
              defaultValue: "Birthdays for your child's group will appear here after linking.",
            })}
            actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
            onActionPress={() => router.push('/screens/parent-child-registration' as any)}
            size="small"
            secondary
          />
        )}
      </CollapsibleSection>

      {/* Today's Activities */}
      <CollapsibleSection
        title={t('dashboard.todays_activities', { defaultValue: "Today's Activities" })}
        sectionId="daily-activities"
        icon="☀️"
        hint={t('dashboard.hints.daily_activities', { defaultValue: 'Daily class activities, photos, and updates.' })}
        defaultCollapsed={collapsedSections.has('daily-activities')}
        onToggle={toggleSection}
        attention={sectionAttention['daily-activities']}
      >
        {dashboardData?.children?.find((c: any) => c.id === activeChildId)?.classId ? (
          <DailyActivityFeed
            classId={dashboardData?.children?.find((c: any) => c.id === activeChildId)?.classId}
            studentId={activeChildId || undefined}
            showHeader={false}
          />
        ) : (
          <EmptyState
            icon="sunny-outline"
            title={t('dashboard.parent.empty.daily_activity.title', { defaultValue: 'Daily activity preview' })}
            description={t('dashboard.parent.empty.daily_activity.description', {
              defaultValue: 'Daily activities will appear here once a child is linked.',
            })}
            actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
            onActionPress={() => router.push('/screens/parent-child-registration' as any)}
            size="small"
            secondary
          />
        )}
      </CollapsibleSection>
    </>
  );
};
