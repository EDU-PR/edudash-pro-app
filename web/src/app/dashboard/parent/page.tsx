'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { AskAIWidget } from '@/components/dashboard/AskAIWidget';
import { QuotaCard } from '@/components/dashboard/QuotaCard';
import { JoinLiveLessonWithToggle } from '@/components/calls';
import { useParentOverviewMetrics } from '@/lib/hooks/parent/useParentOverviewMetrics';
import { useOnboardingHint } from '@/lib/hooks/useOnboardingHint';
import { TeacherQuickNotesCard } from '@/components/dashboard/parent/TeacherQuickNotesCard';
import { ChildProgressBadgesCard } from '@/components/dashboard/parent/ChildProgressBadgesCard';
import { DailyActivityFeedCard } from '@/components/dashboard/parent/DailyActivityFeedCard';
import { UpcomingBirthdaysCard } from '@/components/dashboard/parent/UpcomingBirthdaysCard';
import { MetricCard } from '@/components/dashboard/parent/MetricCard';
import { OnboardingHint } from '@/components/dashboard/parent/OnboardingHint';
import { UpgradeBanner } from '@/components/dashboard/parent/UpgradeBanner';
import { AdBannerPlaceholder } from '@/components/dashboard/parent/AdBannerPlaceholder';
import { DashOrbButton } from '@/components/dashboard/parent/DashOrbButton';
import { Users, BarChart3, BookOpen, Lightbulb, Search, Activity, Brain, Cpu, Laptop, Sparkles, Shirt, MessageCircle, PhoneOff, CalendarCheck } from 'lucide-react';
import { ActivityFeed } from '@/components/dashboard/parent/ActivityFeed';
import { UniformSizesWidget } from '@/components/dashboard/parent/UniformSizesWidget';

export default function ParentDashboard() {
  const router = useRouter();
  
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
  const [showAskAI, setShowAskAI] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiDisplay, setAIDisplay] = useState('');
  const [aiLanguage, setAILanguage] = useState('en-ZA');
  const [aiInteractive, setAIInteractive] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('children'); // Auto-open My Children by default

  // Get pending homework count for badge
  const { count: homeworkCount } = usePendingHomework(userId || undefined);

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

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
    setAIPrompt(prompt);
    setAIDisplay(display);
    setAILanguage(language || 'en-ZA');
    setAIInteractive(enableInteractive || false);
    setShowAskAI(true);
  };

  const handleCloseAI = () => {
    setShowAskAI(false);
    setAIPrompt('');
    setAIDisplay('');
    setAILanguage('en-ZA');
    setAIInteractive(false);
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
    const dob = new Date(dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    return age;
  };

  // Extract grade number from grade string (e.g., "Grade 4" -> 4)
  const getGradeNumber = (gradeString?: string): number => {
    if (!gradeString) return 0;
    const match = gradeString.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };
  
  const activeChildAge = activeChild ? getChildAge(activeChild.dateOfBirth) : 0;
  const activeChildGrade = activeChild ? getGradeNumber(activeChild.grade) : 0;

  // Check if ALL children are preschoolers (under 6 years)
  const allChildrenArePreschoolers = childrenCards.length > 0 && childrenCards.every(child => getChildAge(child.dateOfBirth) < 6);
  // Grade 4+ gets exam features (with daily quota)
  const isExamEligible = activeChildGrade >= 4;
  
  // All children get access to general features (Dash Chat, Robotics, etc) with quotas
  const hasAnyChild = childrenCards.length > 0 && childrenCards.some(c => c.dateOfBirth);

  const feesDue = metrics?.feesDue ?? null;
  const attendanceRate = overviewMetrics.attendanceRate;
  const missedCalls = overviewMetrics.missedCalls;

  const subscriptionTier = (profile?.subscription_tier || '').toLowerCase();
  const isFreeTier = !subscriptionTier || subscriptionTier === 'free';
  const showUpgradeBanner = isFreeTier && !trialStatus?.is_trial;

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
              placeholder="Search homework, messages, children..."
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
              title="Unlock more parent tools"
              description="Get homework help, progress insights, and remove ads by upgrading."
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

        {childrenCards.length > 0 && (
          <CollapsibleSection 
            title="My Children" 
            icon={Users} 
            isOpen={openSection === 'children'}
            onToggle={() => setOpenSection(openSection === 'children' ? null : 'children')}
          >
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
                      Homework
                    </div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      <div className="font-semibold" style={{ fontSize: 16 }}>{child.upcomingEvents}</div>
                      Events
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Uniform Sizes (organization-linked parents only) */}
        {hasOrganization && childrenCards.length > 0 && (
          <CollapsibleSection
            title="Uniform Sizes"
            icon={Shirt}
            isOpen={openSection === 'uniforms'}
            onToggle={() => setOpenSection(openSection === 'uniforms' ? null : 'uniforms')}
          >
            <UniformSizesWidget childrenCards={childrenCards} />
          </CollapsibleSection>
        )}

        {/* Quick Actions Grid - Show if children exist with age */}
        {hasAnyChild && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {showQuickActionsHint && (
              <OnboardingHint
                title="Quick Actions"
                message="Tap any card to quickly access homework, messages, payments, or Dash AI."
                onDismiss={dismissQuickActionsHint}
              />
            )}
            <QuickActionsGrid 
              usageType={usageType} 
              hasOrganization={hasOrganization}
              activeChildGrade={activeChildGrade}
              isExamEligible={isExamEligible}
              unreadCount={unreadCount}
              homeworkCount={homeworkCount}
              userId={userId}
              preschoolId={profile?.preschoolId}
              feesDue={feesDue}
            />
          </div>
        )}

        {/* Recent Activity Feed */}
        {hasAnyChild && userId && (
          <CollapsibleSection 
            title="Recent Activity" 
            icon={Activity} 
            isOpen={openSection === 'activity'}
            onToggle={() => setOpenSection(openSection === 'activity' ? null : 'activity')}
          >
            <ActivityFeed 
              userId={userId} 
              activeChildId={activeChildId || undefined}
              limit={8}
            />
          </CollapsibleSection>
        )}

        {/* Homework Card - Show if organization-linked */}
        {hasOrganization && userId && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <HomeworkCard userId={userId} />
          </div>
        )}

        {/* Live Lessons Section - Show if organization-linked with active child */}
        {hasOrganization && activeChild && profile?.preschoolId && (
          <div className="section" style={{ marginTop: 'var(--space-4)' }}>
            {showLiveClassesHint && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <OnboardingHint
                  title="Live Classes"
                  message="When a teacher starts a live class, you can join here instantly."
                  onDismiss={dismissLiveClassesHint}
                />
              </div>
            )}
            <JoinLiveLessonWithToggle 
              preschoolId={profile.preschoolId} 
              classId={activeChild.classId}
            />
          </div>
        )}

        {/* Teacher Notes */}
        {hasOrganization && activeChildId && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <TeacherQuickNotesCard studentId={activeChildId} />
          </div>
        )}

        {/* Child Progress & Achievements */}
        {activeChildId && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <ChildProgressBadgesCard studentId={activeChildId} />
          </div>
        )}

        {/* Upcoming Birthdays */}
        {hasOrganization && activeChild?.classId && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <UpcomingBirthdaysCard classId={activeChild.classId} />
          </div>
        )}

        {/* Daily Activity Feed */}
        {hasOrganization && activeChild?.classId && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <DailyActivityFeedCard classId={activeChild.classId} />
          </div>
        )}

        {/* Ad placeholders for free tier */}
        {showUpgradeBanner && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <AdBannerPlaceholder onUpgrade={() => router.push('/pricing')} variant="bottom" />
          </div>
        )}

        {/* Practice at Home Hub - STEM Activities */}
        {hasAnyChild && activeChild && (
          <CollapsibleSection 
            title="Practice at Home" 
            icon={Sparkles} 
            isOpen={openSection === 'practice'}
            onToggle={() => setOpenSection(openSection === 'practice' ? null : 'practice')}
          >
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
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>Robotics Practice</h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  Explore robot movements, basic programming, and sensor activities
                </p>
              </div>
              
              <div 
                className="card card-interactive" 
                onClick={() => {
                  setAIPrompt('Help me create age-appropriate AI learning activities for my child');
                  setAIDisplay('AI Learning Activities');
                  setShowAskAI(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Brain className="icon24" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>AI Activities</h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  Age-appropriate AI learning games and pattern recognition activities
                </p>
              </div>
              
              <div 
                className="card card-interactive" 
                onClick={() => {
                  setAIPrompt('Help me teach my child basic computer skills like using a mouse, keyboard, and safe online practices');
                  setAIDisplay('Computer Literacy Guide');
                  setShowAskAI(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Laptop className="icon24" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>Computer Literacy</h3>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                  Basic skills practice: typing, mouse control, app navigation, online safety
                </p>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Early Learning Activities - ONLY for preschoolers */}
        {allChildrenArePreschoolers && activeChild && (
          <CollapsibleSection 
            title="Early Learning Activities" 
            icon={BookOpen} 
            isOpen={openSection === 'activities'}
            onToggle={() => setOpenSection(openSection === 'activities' ? null : 'activities')}
          >
            <CAPSActivitiesWidget
              childAge={activeChildAge}
              childName={activeChild.firstName}
              onAskDashAI={(prompt, display) => handleAskFromActivity(prompt, display)}
            />
          </CollapsibleSection>
        )}

        {/* Preschool Learning Tips - ONLY for preschoolers */}
        {allChildrenArePreschoolers && childrenCards.length > 0 && (
          <CollapsibleSection 
            title="Early Learning Tips for Parents" 
            icon={Lightbulb} 
            isOpen={openSection === 'tips'}
            onToggle={() => setOpenSection(openSection === 'tips' ? null : 'tips')}
          >
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Supporting Your Preschooler's Development</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <strong>🎨 Creative Play</strong>
                  <p style={{ margin: '4px 0', color: 'var(--muted)' }}>Encourage drawing, painting, and imaginative play to develop creativity and fine motor skills.</p>
                </div>
                <div>
                  <strong>📚 Reading Together</strong>
                  <p style={{ margin: '4px 0', color: 'var(--muted)' }}>Read stories daily to build language skills, vocabulary, and a love for books.</p>
                </div>
                <div>
                  <strong>🔢 Numbers & Shapes</strong>
                  <p style={{ margin: '4px 0', color: 'var(--muted)' }}>Use everyday activities to introduce counting, colors, and shapes in fun ways.</p>
                </div>
                <div>
                  <strong>🎵 Songs & Rhymes</strong>
                  <p style={{ margin: '4px 0', color: 'var(--muted)' }}>Sing songs and recite rhymes to develop memory, rhythm, and phonological awareness.</p>
                </div>
                <div>
                  <strong>🤝 Social Skills</strong>
                  <p style={{ margin: '4px 0', color: 'var(--muted)' }}>Arrange playdates and teach sharing, turn-taking, and expressing emotions.</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Overview Section (ONLY for organization-linked parents) */}
        {hasOrganization && (
          <CollapsibleSection 
            title="Today's Overview" 
            icon={BarChart3} 
            isOpen={openSection === 'overview'}
            onToggle={() => setOpenSection(openSection === 'overview' ? null : 'overview')}
          >
            <div className="grid2">
              <MetricCard
                title="Unread Messages"
                value={unreadCount}
                icon={MessageCircle}
                color="#8b5cf6"
                onPress={() => router.push('/dashboard/parent/messages')}
              />
              <MetricCard
                title="Missed Calls"
                value={missedCalls}
                icon={PhoneOff}
                color="#10b981"
                onPress={() => router.push('/dashboard/parent/messages')}
              />
              <MetricCard
                title="Homework Pending"
                value={activeChild ? metrics.pendingHomework : homeworkCount}
                icon={BookOpen}
                color="#f59e0b"
                onPress={() => router.push('/dashboard/parent/homework')}
              />
              <MetricCard
                title="Attendance Rate"
                value={`${attendanceRate}%`}
                icon={CalendarCheck}
                color="#22c55e"
                onPress={() => router.push('/dashboard/parent/progress')}
              />
            </div>
          </CollapsibleSection>
        )}
      </div>

      <DashOrbButton
        onClick={() => {
          setAIPrompt('How can I support my child today?');
          setAIDisplay('Dash AI Helper');
          setShowAskAI(true);
        }}
      />

      {/* AI Widget Modal */}
      {showAskAI && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{ width: '100%', maxWidth: 800, position: 'relative' }}>
            <button
              onClick={handleCloseAI}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer',
                color: 'white'
              }}
            >
              Close
            </button>
            <AskAIWidget
              fullscreen={true}
              initialPrompt={aiPrompt}
              displayMessage={aiDisplay}
              language={aiLanguage}
              enableInteractive={aiInteractive}
              userId={userId}
              onClose={handleCloseAI}
            />
          </div>
        </div>
      )}
    </ParentShell>
  );
}
