/**
 * ParentDashboardContentSections (Web)
 *
 * Extracted from parent/page.tsx — contains the homework,
 * live classes, teacher notes, progress, insights, birthdays,
 * birthday chart, daily activity, and overview CollapsibleSections.
 *
 * ≤400 lines (WARP-compliant component)
 */

'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CollapsibleSection } from '@/components/dashboard/parent/CollapsibleSection';
import { HomeworkCard } from '@/components/dashboard/parent/HomeworkCard';
import { JoinLiveLessonWithToggle } from '@/components/calls';
import { TeacherQuickNotesCard } from '@/components/dashboard/parent/TeacherQuickNotesCard';
import { ChildProgressBadgesCard } from '@/components/dashboard/parent/ChildProgressBadgesCard';
import { DailyActivityFeedCard } from '@/components/dashboard/parent/DailyActivityFeedCard';
import { UpcomingBirthdaysCard } from '@/components/dashboard/parent/UpcomingBirthdaysCard';
import { BirthdayChartPreviewCard } from '@/components/dashboard/parent/BirthdayChartPreviewCard';
import { MetricCard } from '@/components/dashboard/parent/MetricCard';
import { OnboardingHint } from '@/components/dashboard/parent/OnboardingHint';
import { ParentInsightsSection } from '@/components/dashboard/parent/ParentInsightsSection';
import type { ProactiveInsight, PredictiveAlert } from '@/lib/hooks/parent/useParentInsights';
import { BookOpen, BarChart3, MessageCircle, PhoneOff, CalendarCheck, Video, Cake, Sparkles } from 'lucide-react';
import type { ParentDashboardCopy } from '@/app/dashboard/parent/parentDashboardCopy';

// --- Shared empty state ---
function SectionEmptyState({ title, description, actionLabel, onAction }: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

interface ActiveChild {
  id: string;
  firstName: string;
  classId?: string;
}

interface ParentDashboardContentSectionsProps {
  COPY: ParentDashboardCopy;
  openSection: string | null;
  toggleSection: (key: string) => void;
  userId: string | undefined;
  hasOrganization: boolean;
  hasChildren: boolean;
  activeChild: ActiveChild | null;
  activeChildId: string | null;
  allChildrenArePreschoolers: boolean;
  showLiveClassesHint: boolean;
  dismissLiveClassesHint: () => void;
  preschoolId: string | undefined;
  // Insights
  parentInsights: ProactiveInsight[];
  parentAlerts: PredictiveAlert[];
  insightsLoading: boolean;
  insightsError: string | null;
  hasUrgentInsights: boolean;
  // Metrics
  unreadCount: number;
  missedCalls: number;
  homeworkCount: number;
  attendanceRate: number;
  pendingHomework: number;
  organizationId: string | undefined;
}

export function ParentDashboardContentSections({
  COPY,
  openSection,
  toggleSection,
  userId,
  hasOrganization,
  hasChildren,
  activeChild,
  activeChildId,
  allChildrenArePreschoolers,
  showLiveClassesHint,
  dismissLiveClassesHint,
  preschoolId,
  parentInsights,
  parentAlerts,
  insightsLoading,
  insightsError,
  hasUrgentInsights,
  unreadCount,
  missedCalls,
  homeworkCount,
  attendanceRate,
  pendingHomework,
  organizationId,
}: ParentDashboardContentSectionsProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const addChildCta = t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' });
  const goAddChild = () => router.push('/dashboard/parent/register-child');

  return (
    <>
      {/* Homework - Hide for preschool-only */}
      {userId && !allChildrenArePreschoolers && (
        <CollapsibleSection
          title={COPY.sections.homework}
          description={COPY.sectionDescriptions.homework}
          icon={BookOpen}
          isOpen={openSection === 'homework'}
          onToggle={() => toggleSection('homework')}
        >
          {hasOrganization ? (
            <HomeworkCard userId={userId} />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.homework.title', { defaultValue: 'Homework preview' })}
              description={t('dashboard.parent.empty.homework.description', { defaultValue: 'Link a child to a school to view and submit homework.' })}
              actionLabel={addChildCta}
              onAction={goAddChild}
            />
          )}
        </CollapsibleSection>
      )}

      {/* Live Lessons */}
      <CollapsibleSection
        title={COPY.sections.liveClasses}
        description={COPY.sectionDescriptions.liveClasses}
        icon={Video}
        isOpen={openSection === 'live-classes'}
        onToggle={() => toggleSection('live-classes')}
      >
        {showLiveClassesHint && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <OnboardingHint
              title={COPY.hints.liveClassesTitle}
              message={COPY.hints.liveClassesMessage}
              onDismiss={dismissLiveClassesHint}
            />
          </div>
        )}
        {hasOrganization && activeChild && preschoolId ? (
          <JoinLiveLessonWithToggle preschoolId={preschoolId} classId={activeChild.classId} />
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.live_classes.title', { defaultValue: 'Live classes preview' })}
            description={t('dashboard.parent.empty.live_classes.description', { defaultValue: 'Live class links appear here once your child is linked to a school.' })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>

      {/* Teacher Notes */}
      <CollapsibleSection
        title={COPY.sections.teacherNotes}
        description={COPY.sectionDescriptions.teacherNotes}
        icon={MessageCircle}
        isOpen={openSection === 'teacher-notes'}
        onToggle={() => toggleSection('teacher-notes')}
      >
        {hasOrganization && activeChildId ? (
          <TeacherQuickNotesCard studentId={activeChildId} />
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.teacher_notes.title', { defaultValue: 'Teacher notes preview' })}
            description={t('dashboard.parent.empty.teacher_notes.description', { defaultValue: 'Notes from educators will appear here when a child is linked.' })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>

      {/* Progress & Achievements - Hide for preschool-only */}
      {!allChildrenArePreschoolers && (
        <CollapsibleSection
          title={COPY.sections.progress}
          description={COPY.sectionDescriptions.progress}
          icon={BarChart3}
          isOpen={openSection === 'progress'}
          onToggle={() => toggleSection('progress')}
        >
          {activeChildId ? (
            <ChildProgressBadgesCard studentId={activeChildId} />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.progress.title', { defaultValue: 'Progress badges preview' })}
              description={t('dashboard.parent.empty.progress.description', { defaultValue: 'Track milestones and achievements once a child is linked.' })}
              actionLabel={addChildCta}
              onAction={goAddChild}
            />
          )}
        </CollapsibleSection>
      )}

      {/* AI Insights */}
      <CollapsibleSection
        title={t('dashboard.parent.section.insights', { defaultValue: 'AI Insights' })}
        description={t('dashboard.parent.section_desc.insights', { defaultValue: "AI-powered observations about your child's progress." })}
        icon={Sparkles}
        isOpen={openSection === 'insights'}
        onToggle={() => toggleSection('insights')}
      >
        <ParentInsightsSection
          insights={parentInsights}
          alerts={parentAlerts}
          loading={insightsLoading}
          error={insightsError}
        />
      </CollapsibleSection>

      {/* Upcoming Birthdays */}
      <CollapsibleSection
        title={COPY.sections.birthdays}
        description={COPY.sectionDescriptions.birthdays}
        icon={Sparkles}
        isOpen={openSection === 'birthdays'}
        onToggle={() => toggleSection('birthdays')}
      >
        {hasOrganization && activeChild?.classId ? (
          <UpcomingBirthdaysCard classId={activeChild.classId} onViewAll={() => router.push('/dashboard/parent/birthday-chart')} />
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.birthdays.title', { defaultValue: 'Upcoming birthdays preview' })}
            description={t('dashboard.parent.empty.birthdays.description', { defaultValue: "Birthdays for your child's group will appear here after linking." })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>

      {/* Birthday Chart */}
      <CollapsibleSection
        title={COPY.sections.birthdayChart}
        description={COPY.sectionDescriptions.birthdayChart}
        icon={Cake}
        isOpen={openSection === 'birthday-chart'}
        onToggle={() => toggleSection('birthday-chart')}
      >
        {hasOrganization ? (
          <BirthdayChartPreviewCard organizationId={organizationId} />
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.birthdays.title', { defaultValue: 'Upcoming birthdays preview' })}
            description={t('dashboard.parent.empty.birthdays.description', { defaultValue: "Birthdays for your child's group will appear here after linking." })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>

      {/* Daily Activity Feed */}
      <CollapsibleSection
        title={COPY.sections.dailyActivity}
        description={COPY.sectionDescriptions.dailyActivity}
        icon={BookOpen}
        isOpen={openSection === 'daily-activity'}
        onToggle={() => toggleSection('daily-activity')}
      >
        {hasOrganization && activeChild?.classId ? (
          <DailyActivityFeedCard classId={activeChild.classId} studentId={activeChild.id} />
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.daily_activity.title', { defaultValue: 'Daily activity preview' })}
            description={t('dashboard.parent.empty.daily_activity.description', { defaultValue: 'Daily activity updates will show here once a child is linked.' })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>

      {/* Overview (org-linked only) */}
      <CollapsibleSection
        title={COPY.sections.overview}
        description={COPY.sectionDescriptions.overview}
        icon={BarChart3}
        isOpen={openSection === 'overview'}
        onToggle={() => toggleSection('overview')}
      >
        {hasOrganization ? (
          <div className="grid2">
            <MetricCard title={COPY.overviewCards.unreadMessages} value={unreadCount} icon={MessageCircle} color="#8b5cf6" onPress={() => router.push('/dashboard/parent/messages')} />
            <MetricCard title={COPY.overviewCards.missedCalls} value={missedCalls} icon={PhoneOff} color="#10b981" onPress={() => router.push('/dashboard/parent/messages')} />
            <MetricCard title={COPY.overviewCards.homeworkPending} value={activeChild ? pendingHomework : homeworkCount} icon={BookOpen} color="#f59e0b" onPress={() => router.push('/dashboard/parent/homework')} />
            <MetricCard title={COPY.overviewCards.attendanceRate} value={`${attendanceRate}%`} icon={CalendarCheck} color="#22c55e" onPress={() => router.push('/dashboard/parent/progress')} />
          </div>
        ) : (
          <SectionEmptyState
            title={t('dashboard.parent.empty.overview.title', { defaultValue: 'Overview preview' })}
            description={t('dashboard.parent.empty.overview.description', { defaultValue: 'Link a child to a school to see attendance, homework, and messages.' })}
            actionLabel={addChildCta}
            onAction={goAddChild}
          />
        )}
      </CollapsibleSection>
    </>
  );
}
