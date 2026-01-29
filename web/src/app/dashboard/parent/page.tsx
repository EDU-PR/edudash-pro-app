'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { useTierUpdates } from '@/hooks/useTierUpdates';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { DashboardHeader } from '@/components/dashboard/parent/DashboardHeader';
import { TrialBanner } from '@/components/dashboard/parent/TrialBanner';
import { PendingRequestsWidget } from '@/components/dashboard/parent/PendingRequestsWidget';
import { EmptyChildrenState } from '@/components/dashboard/parent/EmptyChildrenState';
import { QuickActionsGrid } from '@/components/dashboard/parent/QuickActionsGrid';
import { CAPSActivitiesWidget } from '@/components/dashboard/parent/CAPSActivitiesWidget';
import { CollapsibleSection } from '@/components/dashboard/parent/CollapsibleSection';
import { HomeworkCard } from '@/components/dashboard/parent/HomeworkCard';
import { usePendingHomework } from '@/lib/hooks/parent/usePendingHomework';
import { QuotaCard } from '@/components/dashboard/QuotaCard';
import { JoinLiveLessonWithToggle } from '@/components/calls';
import { useParentOverviewMetrics } from '@/lib/hooks/parent/useParentOverviewMetrics';
import { useOnboardingHint } from '@/lib/hooks/useOnboardingHint';
import { getGradeNumber, isExamEligibleChild } from '@/lib/utils/gradeUtils';
import { TeacherQuickNotesCard } from '@/components/dashboard/parent/TeacherQuickNotesCard';
import { ChildProgressBadgesCard } from '@/components/dashboard/parent/ChildProgressBadgesCard';
import { DailyActivityFeedCard } from '@/components/dashboard/parent/DailyActivityFeedCard';
import { UpcomingBirthdaysCard } from '@/components/dashboard/parent/UpcomingBirthdaysCard';
import { MetricCard } from '@/components/dashboard/parent/MetricCard';
import { OnboardingHint } from '@/components/dashboard/parent/OnboardingHint';
import { UpgradeBanner } from '@/components/dashboard/parent/UpgradeBanner';
import { AdBannerPlaceholder } from '@/components/dashboard/parent/AdBannerPlaceholder';
import { DashOrbButton } from '@/components/dashboard/parent/DashOrbButton';
import { Users, BarChart3, BookOpen, Lightbulb, Search, Activity, Brain, Cpu, Laptop, Sparkles, Shirt, MessageCircle, PhoneOff, CalendarCheck, Video } from 'lucide-react';
import { ActivityFeed } from '@/components/dashboard/parent/ActivityFeed';
import { UniformSizesWidget } from '@/components/dashboard/parent/UniformSizesWidget';

export default function ParentDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const COPY = useMemo(() => ({
    greetings: {
      morning: t('dashboard.good_morning', { defaultValue: 'Good morning' }),
      afternoon: t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' }),
      evening: t('dashboard.good_evening', { defaultValue: 'Good evening' }),
    },
    searchPlaceholder: t('dashboard.parent.search_placeholder', { defaultValue: 'Search homework, messages, children...' }),
    upgradeBanner: {
      title: t('dashboard.parent.upgrade_title', { defaultValue: 'Unlock more parent tools' }),
      description: t('dashboard.parent.upgrade_description', { defaultValue: 'Get homework help, progress insights, and remove ads by upgrading.' }),
    },
    hints: {
      quickActionsTitle: t('dashboard.parent.hint.quick_actions.title', { defaultValue: 'Quick Actions' }),
      quickActionsMessage: t('dashboard.parent.hint.quick_actions.message', { defaultValue: 'Tap any card to quickly access homework, messages, payments, or Dash AI.' }),
      liveClassesTitle: t('dashboard.parent.hint.live_classes.title', { defaultValue: 'Live Classes' }),
      liveClassesMessage: t('dashboard.parent.hint.live_classes.message', { defaultValue: 'When a teacher starts a live class, you can join here instantly.' }),
    },
    sections: {
      myChildren: t('dashboard.parent.section.my_children', { defaultValue: 'My Children' }),
      uniformSizes: t('dashboard.parent.section.uniform_sizes', { defaultValue: 'Uniform Sizes' }),
      recentActivity: t('dashboard.parent.section.recent_activity', { defaultValue: 'Recent Activity' }),
      homework: t('dashboard.parent.section.homework', { defaultValue: 'Homework' }),
      liveClasses: t('dashboard.parent.section.live_classes', { defaultValue: 'Live Classes' }),
      teacherNotes: t('dashboard.parent.section.teacher_notes', { defaultValue: 'Teacher Notes' }),
      progress: t('dashboard.parent.section.progress', { defaultValue: 'Progress & Achievements' }),
      birthdays: t('dashboard.parent.section.birthdays', { defaultValue: 'Upcoming Birthdays' }),
      dailyActivity: t('dashboard.parent.section.daily_activity', { defaultValue: 'Daily Activity' }),
      practiceAtHome: t('dashboard.parent.section.practice_at_home', { defaultValue: 'Practice at Home' }),
      earlyLearningActivities: t('dashboard.parent.section.early_learning_activities', { defaultValue: 'Early Learning Activities' }),
      earlyLearningTips: t('dashboard.parent.section.early_learning_tips', { defaultValue: 'Early Learning Tips for Parents' }),
      overview: t('dashboard.parent.section.overview', { defaultValue: "Today's Overview" }),
    },
    childCard: {
      homework: t('dashboard.parent.child_card.homework', { defaultValue: 'Homework' }),
      events: t('dashboard.parent.child_card.events', { defaultValue: 'Events' }),
    },
    practiceCards: {
      robotics: {
        title: t('dashboard.parent.practice.robotics.title', { defaultValue: 'Robotics Practice' }),
        description: t('dashboard.parent.practice.robotics.description', { defaultValue: 'Explore robot movements, basic programming, and sensor activities' }),
      },
      aiActivities: {
        title: t('dashboard.parent.practice.ai.title', { defaultValue: 'AI Activities' }),
        description: t('dashboard.parent.practice.ai.description', { defaultValue: 'Age-appropriate AI learning games and pattern recognition activities' }),
      },
      computerLiteracy: {
        title: t('dashboard.parent.practice.computer.title', { defaultValue: 'Computer Literacy' }),
        description: t('dashboard.parent.practice.computer.description', { defaultValue: 'Basic skills practice: typing, mouse control, app navigation, online safety' }),
      },
    },
    earlyLearning: {
      heading: t('dashboard.parent.early_learning.heading', { defaultValue: "Supporting Your Preschooler's Development" }),
      tips: [
        {
          title: t('dashboard.parent.early_learning.tips.creative_play.title', { defaultValue: '🎨 Creative Play' }),
          description: t('dashboard.parent.early_learning.tips.creative_play.description', { defaultValue: 'Encourage drawing, painting, and imaginative play to develop creativity and fine motor skills.' }),
        },
        {
          title: t('dashboard.parent.early_learning.tips.reading.title', { defaultValue: '📚 Reading Together' }),
          description: t('dashboard.parent.early_learning.tips.reading.description', { defaultValue: 'Read stories daily to build language skills, vocabulary, and a love for books.' }),
        },
        {
          title: t('dashboard.parent.early_learning.tips.numbers.title', { defaultValue: '🔢 Numbers & Shapes' }),
          description: t('dashboard.parent.early_learning.tips.numbers.description', { defaultValue: 'Use everyday activities to introduce counting, colors, and shapes in fun ways.' }),
        },
        {
          title: t('dashboard.parent.early_learning.tips.songs.title', { defaultValue: '🎵 Songs & Rhymes' }),
          description: t('dashboard.parent.early_learning.tips.songs.description', { defaultValue: 'Sing songs and recite rhymes to develop memory, rhythm, and phonological awareness.' }),
        },
        {
          title: t('dashboard.parent.early_learning.tips.social.title', { defaultValue: '🤝 Social Skills' }),
          description: t('dashboard.parent.early_learning.tips.social.description', { defaultValue: 'Arrange playdates and teach sharing, turn-taking, and expressing emotions.' }),
        },
      ],
    },
    overviewCards: {
      unreadMessages: t('dashboard.parent.overview.unread_messages', { defaultValue: 'Unread Messages' }),
      missedCalls: t('dashboard.parent.overview.missed_calls', { defaultValue: 'Missed Calls' }),
      homeworkPending: t('dashboard.parent.overview.homework_pending', { defaultValue: 'Homework Pending' }),
      attendanceRate: t('dashboard.parent.overview.attendance_rate', { defaultValue: 'Attendance Rate' }),
    },
    aiModalClose: t('dashboard.parent.ai.close', { defaultValue: 'Close' }),
  }), [t]);
  
  // Get all data from custom hook
  const {
    userId,
    profile,
    userName,
    preschoolName,
    usageType,
    hasOrganization,
    tenantSlug,
    childrenCards,
    activeChildId,
    setActiveChildId,
    childrenLoading,
    metrics,
    unreadCount,
    trialStatus,
    loading,
  } = useParentDashboardData();
  
  // Listen for tier updates
  useTierUpdates(userId, () => {
    // Reload the page to refresh quota data
    window.location.reload();
  });
  
  // Local state
  const [greeting, setGreeting] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = (sectionId: string) => {
    setOpenSection((prev) => (prev === sectionId ? null : sectionId));
  };

  // Get pending homework count for badge
  const { count: homeworkCount } = usePendingHomework(userId || undefined);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting(COPY.greetings.morning);
    else if (hour < 18) setGreeting(COPY.greetings.afternoon);
    else setGreeting(COPY.greetings.evening);
  }, [COPY.greetings.morning, COPY.greetings.afternoon, COPY.greetings.evening]);

  // Auth guard
  useEffect(() => {
    if (!loading && !userId) {
      router.push('/sign-in');
    }
  }, [loading, userId, router]);

  const childIds = useMemo(() => childrenCards.map((child) => child.id), [childrenCards]);
  const { metrics: overviewMetrics } = useParentOverviewMetrics({
    userId,
    childIds,
    organizationId: profile?.organizationId || profile?.preschoolId || null,
  });

  const [showQuickActionsHint, dismissQuickActionsHint] = useOnboardingHint('parent_quick_actions');
  const [showLiveClassesHint, dismissLiveClassesHint] = useOnboardingHint('parent_live_classes');

  // Handle AI interactions
  const handleAskFromActivity = async (
    prompt: string, 
    display: string, 
    language?: string, 
    enableInteractive?: boolean
  ) => {
    const params = new URLSearchParams();
    params.set('prompt', prompt);
    if (display) params.set('display', display);
    if (language) params.set('language', language);
    if (enableInteractive) params.set('interactive', 'true');
    router.push(`/dashboard/parent/dash-chat?${params.toString()}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // Active child and age calculations
  const activeChild = childrenCards.find((c) => c.id === activeChildId);
  
  // Calculate age of active child (for age-appropriate content)
  const getChildAge = (dateOfBirth?: string): number => {
    if (!dateOfBirth) return 0;
    const [yearStr, monthStr, dayStr] = dateOfBirth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return 0;
    const today = new Date();
    let age = today.getFullYear() - year;
    const monthDiff = (today.getMonth() + 1) - month;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
      age -= 1;
    }
    return Math.max(age, 0);
  };

  const activeChildAge = activeChild ? getChildAge(activeChild.dateOfBirth) : 0;
  const activeChildGrade = activeChild ? getGradeNumber(activeChild.grade) : 0;

  // Check if ALL children are preschoolers (under 6 years)
  const allChildrenArePreschoolers = childrenCards.length > 0 && childrenCards.every(child => getChildAge(child.dateOfBirth) < 6);
  // Grade 4+ and school-age learners only
  const hasExamEligibleChild = activeChild ? isExamEligibleChild(activeChild.grade, activeChild.dateOfBirth) : false;
  
  // All children get access to general features (Dash Chat, Robotics, etc) with quotas
  const hasAnyChild = childrenCards.length > 0 && childrenCards.some(c => c.dateOfBirth);
  const hasChildren = childrenCards.length > 0;

  const feesDue = metrics?.feesDue ?? null;
  const attendanceRate = overviewMetrics.attendanceRate;
  const missedCalls = overviewMetrics.missedCalls;

  const subscriptionTier = (profile?.subscription_tier || '').toLowerCase();
  const isFreeTier = !subscriptionTier || subscriptionTier === 'free';
  const showUpgradeBanner = isFreeTier && !trialStatus?.is_trial;

  interface SectionEmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
  }

  const SectionEmptyState = ({ title, description, actionLabel, onAction }: SectionEmptyStateProps) => (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );

  return (
    <ParentShell
      tenantSlug={tenantSlug}
      userEmail={profile?.email}
      userName={userName}
      preschoolName={preschoolName}
      unreadCount={unreadCount}
      hasOrganization={hasOrganization}
    >
      <div className="container parent-dashboard-main">
        {/* Search Bar */}
        <div style={{ marginTop: 0, marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Search className="searchIcon icon16" />
            <input
              className="searchInput"
              placeholder={COPY.searchPlaceholder}
              onKeyDown={(e) => {
                const t = e.target as HTMLInputElement;
                if (e.key === 'Enter' && t.value.trim()) {
                  router.push(`/dashboard/parent/search?q=${encodeURIComponent(t.value.trim())}`);
                }
              }}
            />
          </div>
        </div>

        {/* Header */}
        <DashboardHeader userName={userName} greeting={greeting} />

        {/* Trial Banner */}
        <TrialBanner trialStatus={trialStatus} />

        {showUpgradeBanner && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <UpgradeBanner
              title={COPY.upgradeBanner.title}
              description={COPY.upgradeBanner.description}
              onUpgrade={() => router.push('/pricing')}
            />
          </div>
        )}

        {/* AI Usage Quota Card - Only show if children exist and have age */}
        {userId && childrenCards.length > 0 && childrenCards.some(c => c.dateOfBirth) && (
          <QuotaCard userId={userId} />
        )}

        {/* Pending Requests (ONLY for organization-linked parents) */}
        {hasOrganization && <PendingRequestsWidget userId={userId} />}

        {/* Children Section */}
        {childrenCards.length === 0 && !childrenLoading && (
          <EmptyChildrenState
            usageType={usageType}
            onAddChild={() => {
              // Community School parents always use register-child (auto-approved)
              // Organization-linked parents use claim-child (needs approval)
              router.push('/dashboard/parent/register-child');
            }}
          />
        )}

        <CollapsibleSection 
          title={COPY.sections.myChildren}
          icon={Users} 
          isOpen={openSection === 'children'}
          onToggle={() => toggleSection('children')}
        >
          {hasChildren ? (
            <div className="flex gap-3 overflow-x-auto" style={{ paddingBottom: 'var(--space-2)' }}>
              {childrenCards.map((child) => (
                <div
                  key={child.id}
                  className="card card-interactive"
                  style={{
                    border: activeChildId === child.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    minWidth: '280px',
                    flexShrink: 0,
                    padding: '16px'
                  }}
                  onClick={() => setActiveChildId(child.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                      {child.firstName[0]}{child.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold" style={{ fontSize: 16 }}>
                        {child.firstName} {child.lastName}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {child.grade}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      <div className="font-semibold" style={{ fontSize: 16 }}>{child.homeworkPending}</div>
                      {COPY.childCard.homework}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      <div className="font-semibold" style={{ fontSize: 16 }}>{child.upcomingEvents}</div>
                      {COPY.childCard.events}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.add_child.title', { defaultValue: 'Add your child' })}
              description={t('dashboard.parent.empty.add_child.description', { defaultValue: 'Link a child to unlock homework, progress insights, and personalized updates.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Uniform Sizes (organization-linked parents only) */}
        <CollapsibleSection
          title={COPY.sections.uniformSizes}
          icon={Shirt}
          isOpen={openSection === 'uniforms'}
          onToggle={() => toggleSection('uniforms')}
        >
          {hasOrganization && hasChildren ? (
            <UniformSizesWidget childrenCards={childrenCards} />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.uniform_sizes.title', { defaultValue: 'Uniform sizes preview' })}
              description={t('dashboard.parent.empty.uniform_sizes.description', { defaultValue: 'Link a child to a school to see uniform sizes and sizing updates.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Quick Actions Grid - Show if children exist with age */}
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {showQuickActionsHint && (
            <OnboardingHint
              title={COPY.hints.quickActionsTitle}
              message={COPY.hints.quickActionsMessage}
              onDismiss={dismissQuickActionsHint}
            />
          )}
          <QuickActionsGrid 
            usageType={usageType} 
            hasOrganization={hasOrganization}
            activeChildGrade={activeChildGrade}
            isExamEligible={hasExamEligibleChild}
            unreadCount={unreadCount}
            homeworkCount={homeworkCount}
            userId={userId}
            preschoolId={profile?.preschoolId}
            feesDue={feesDue}
          />
        </div>

        {/* Recent Activity Feed */}
        {userId && (
          <CollapsibleSection 
            title={COPY.sections.recentActivity}
            icon={Activity} 
            isOpen={openSection === 'activity'}
            onToggle={() => toggleSection('activity')}
          >
            {hasChildren ? (
              <ActivityFeed 
                userId={userId} 
                activeChildId={activeChildId || undefined}
                limit={8}
              />
            ) : (
              <SectionEmptyState
                title={t('dashboard.parent.empty.recent_activity.title', { defaultValue: 'Recent activity preview' })}
                description={t('dashboard.parent.empty.recent_activity.description', { defaultValue: "Once a child is linked, you'll see homework, messages, and announcements here." })}
                actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
                onAction={() => router.push('/dashboard/parent/register-child')}
              />
            )}
          </CollapsibleSection>
        )}

        {/* Homework Card - Show if organization-linked */}
        {userId && (
          <CollapsibleSection
            title={COPY.sections.homework}
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
                actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
                onAction={() => router.push('/dashboard/parent/register-child')}
              />
            )}
          </CollapsibleSection>
        )}

        {/* Live Lessons Section - Show if organization-linked with active child */}
        <CollapsibleSection
          title={COPY.sections.liveClasses}
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
          {hasOrganization && activeChild && profile?.preschoolId ? (
            <JoinLiveLessonWithToggle 
              preschoolId={profile.preschoolId} 
              classId={activeChild.classId}
            />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.live_classes.title', { defaultValue: 'Live classes preview' })}
              description={t('dashboard.parent.empty.live_classes.description', { defaultValue: 'Live class links appear here once your child is linked to a school.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Teacher Notes */}
        <CollapsibleSection
          title={COPY.sections.teacherNotes}
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
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Child Progress & Achievements */}
        <CollapsibleSection
          title={COPY.sections.progress}
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
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Upcoming Birthdays */}
        <CollapsibleSection
          title={COPY.sections.birthdays}
          icon={Sparkles}
          isOpen={openSection === 'birthdays'}
          onToggle={() => toggleSection('birthdays')}
        >
          {hasOrganization && activeChild?.classId ? (
            <UpcomingBirthdaysCard
              classId={activeChild.classId}
              onViewAll={() => router.push('/dashboard/parent/birthday-chart')}
            />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.birthdays.title', { defaultValue: 'Upcoming birthdays preview' })}
              description={t('dashboard.parent.empty.birthdays.description', { defaultValue: "Birthdays for your child's group will appear here after linking." })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Daily Activity Feed */}
        <CollapsibleSection
          title={COPY.sections.dailyActivity}
          icon={Activity}
          isOpen={openSection === 'daily-activity'}
          onToggle={() => toggleSection('daily-activity')}
        >
          {hasOrganization && activeChild?.classId ? (
            <DailyActivityFeedCard classId={activeChild.classId} />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.daily_activity.title', { defaultValue: 'Daily activity preview' })}
              description={t('dashboard.parent.empty.daily_activity.description', { defaultValue: 'Daily activity updates will show here once a child is linked.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Ad placeholders for free tier */}
        {showUpgradeBanner && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <AdBannerPlaceholder onUpgrade={() => router.push('/pricing')} variant="bottom" />
          </div>
        )}

        {/* Practice at Home Hub - STEM Activities */}
        <CollapsibleSection 
          title={COPY.sections.practiceAtHome}
          icon={Sparkles} 
          isOpen={openSection === 'practice'}
          onToggle={() => toggleSection('practice')}
        >
          {hasAnyChild && activeChild ? (
            <div className="grid2" style={{ marginTop: 16 }}>
              <div 
                className="card card-interactive" 
                onClick={() => router.push('/dashboard/parent/robotics')}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Cpu className="icon24" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
                  {COPY.practiceCards.robotics.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  {COPY.practiceCards.robotics.description}
                </p>
              </div>
              
              <div 
                className="card card-interactive" 
                onClick={() => {
                  handleAskFromActivity(
                    t('dashboard.parent.practice.ai.prompt', { defaultValue: 'Help me create age-appropriate AI learning activities for my child' }),
                    t('dashboard.parent.practice.ai.display', { defaultValue: 'AI Learning Activities' })
                  );
                }}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Brain className="icon24" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
                  {COPY.practiceCards.aiActivities.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  {COPY.practiceCards.aiActivities.description}
                </p>
              </div>
              
              <div 
                className="card card-interactive" 
                onClick={() => {
                  handleAskFromActivity(
                    t('dashboard.parent.practice.computer.prompt', { defaultValue: 'Help me teach my child basic computer skills like using a mouse, keyboard, and safe online practices' }),
                    t('dashboard.parent.practice.computer.display', { defaultValue: 'Computer Literacy Guide' })
                  );
                }}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Laptop className="icon24" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
                  {COPY.practiceCards.computerLiteracy.title}
                </h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  {COPY.practiceCards.computerLiteracy.description}
                </p>
              </div>
            </div>
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.practice.title', { defaultValue: 'Practice at home preview' })}
              description={t('dashboard.parent.empty.practice.description', { defaultValue: 'Practice activities will appear here after a child is linked.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Early Learning Activities - ONLY for preschoolers */}
        <CollapsibleSection 
          title={COPY.sections.earlyLearningActivities}
          icon={BookOpen} 
          isOpen={openSection === 'activities'}
          onToggle={() => toggleSection('activities')}
        >
          {allChildrenArePreschoolers && activeChild ? (
            <CAPSActivitiesWidget
              childAge={activeChildAge}
              childName={activeChild.firstName}
              onAskDashAI={(prompt, display) => handleAskFromActivity(prompt, display)}
            />
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.early_learning_activities.title', { defaultValue: 'Early learning activities preview' })}
              description={hasChildren
                ? t('dashboard.parent.empty.early_learning_activities.description_preschool_only', { defaultValue: 'These activities are available for preschool-age children.' })
                : t('dashboard.parent.empty.early_learning_activities.description_add_child', { defaultValue: 'Add a child to unlock early learning activities.' })}
              actionLabel={hasChildren ? undefined : t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={hasChildren ? undefined : () => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Preschool Learning Tips - ONLY for preschoolers */}
        <CollapsibleSection 
          title={COPY.sections.earlyLearningTips}
          icon={Lightbulb} 
          isOpen={openSection === 'tips'}
          onToggle={() => toggleSection('tips')}
        >
          {allChildrenArePreschoolers && childrenCards.length > 0 ? (
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>{COPY.earlyLearning.heading}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {COPY.earlyLearning.tips.map((tip) => (
                  <div key={tip.title}>
                    <strong>{tip.title}</strong>
                    <p style={{ margin: '4px 0', color: 'var(--muted)' }}>{tip.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.early_learning_tips.title', { defaultValue: 'Early learning tips preview' })}
              description={hasChildren
                ? t('dashboard.parent.empty.early_learning_tips.description_preschool_only', { defaultValue: 'Tips are tailored for preschool-age children.' })
                : t('dashboard.parent.empty.early_learning_tips.description_add_child', { defaultValue: 'Add a child to unlock early learning tips.' })}
              actionLabel={hasChildren ? undefined : t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={hasChildren ? undefined : () => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>

        {/* Overview Section (ONLY for organization-linked parents) */}
        <CollapsibleSection 
          title={COPY.sections.overview}
          icon={BarChart3} 
          isOpen={openSection === 'overview'}
          onToggle={() => toggleSection('overview')}
        >
          {hasOrganization ? (
            <div className="grid2">
              <MetricCard
                title={COPY.overviewCards.unreadMessages}
                value={unreadCount}
                icon={MessageCircle}
                color="#8b5cf6"
                onPress={() => router.push('/dashboard/parent/messages')}
              />
              <MetricCard
                title={COPY.overviewCards.missedCalls}
                value={missedCalls}
                icon={PhoneOff}
                color="#10b981"
                onPress={() => router.push('/dashboard/parent/messages')}
              />
              <MetricCard
                title={COPY.overviewCards.homeworkPending}
                value={activeChild ? metrics.pendingHomework : homeworkCount}
                icon={BookOpen}
                color="#f59e0b"
                onPress={() => router.push('/dashboard/parent/homework')}
              />
              <MetricCard
                title={COPY.overviewCards.attendanceRate}
                value={`${attendanceRate}%`}
                icon={CalendarCheck}
                color="#22c55e"
                onPress={() => router.push('/dashboard/parent/progress')}
              />
            </div>
          ) : (
            <SectionEmptyState
              title={t('dashboard.parent.empty.overview.title', { defaultValue: 'Overview preview' })}
              description={t('dashboard.parent.empty.overview.description', { defaultValue: 'Link a child to a school to see attendance, homework, and messages.' })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onAction={() => router.push('/dashboard/parent/register-child')}
            />
          )}
        </CollapsibleSection>
      </div>

      <DashOrbButton
        onClick={() => {
          const params = new URLSearchParams();
          params.set('prompt', t('dashboard.parent.dash_orb.prompt', { defaultValue: 'How can I support my child today?' }));
          params.set('display', t('dashboard.parent.dash_orb.display', { defaultValue: 'Dash AI Helper' }));
          router.push(`/dashboard/parent/dash-chat?${params.toString()}`);
        }}
      />
    </ParentShell>
  );
}
