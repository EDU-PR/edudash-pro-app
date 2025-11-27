'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
import { Users, BarChart3, BookOpen, Lightbulb } from 'lucide-react';

export default function ParentDashboard() {
  const router = useRouter();
  const supabase = createClient();
  
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
  useTierUpdates(userId, (newTier) => {
    console.log('[Dashboard] Tier updated to:', newTier);
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

  // Handle exam prep navigation
  const handleStartExamPrep = () => {
    // Scroll to exam prep widget or show AI with exam context
    setAIPrompt('I need help preparing for my exams next week. Can you help me create a study plan?');
    setAIDisplay('Exam Preparation Assistant');
    setShowAskAI(true);
  };

  const handleSubjectPractice = (subject: string, grade?: string) => {
    const gradeInfo = grade ? ` for ${grade}` : '';
    setAIPrompt(`Generate a CAPS-aligned practice test for ${subject}${gradeInfo}. Include questions with a detailed memorandum. Make it exam-standard quality.`);
    setAIDisplay(`${subject} Practice Test${gradeInfo}`);
    setShowAskAI(true);
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
  const hasSchoolAgeChildren = childrenCards.some(child => getChildAge(child.dateOfBirth) >= 6);
  
  // Grade 4+ gets exam features (with daily quota)
  const isExamEligible = activeChildGrade >= 4;
  
  // All children get access to general features (Dash Chat, Robotics, etc) with quotas
  const hasAnyChild = childrenCards.length > 0 && childrenCards.some(c => c.dateOfBirth);

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
        {/* Header */}
        <DashboardHeader userName={userName} greeting={greeting} />

        {/* Trial Banner */}
        <TrialBanner trialStatus={trialStatus} />

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
                    border: activeChildId === child.id ? '2px solid var(--primary)' : undefined,
                    minWidth: '280px',
                    flexShrink: 0
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

        {/* Quick Actions Grid - Show if children exist with age */}
        {hasAnyChild && (
          <QuickActionsGrid 
            usageType={usageType} 
            hasOrganization={hasOrganization}
            activeChildGrade={activeChildGrade}
            isExamEligible={isExamEligible}
            unreadCount={unreadCount}
            homeworkCount={homeworkCount}
          />
        )}

        {/* Homework Card - Show if organization-linked */}
        {hasOrganization && userId && (
          <HomeworkCard userId={userId} />
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
            title="Overview" 
            icon={BarChart3} 
            isOpen={openSection === 'overview'}
            onToggle={() => setOpenSection(openSection === 'overview' ? null : 'overview')}
          >
            <div className="grid2">
              <div className="card tile">
                <div className="metricValue">{unreadCount}</div>
                <div className="metricLabel">Unread Messages</div>
              </div>
              <div className="card tile">
                <div className="metricValue">{activeChild ? metrics.pendingHomework : 0}</div>
                <div className="metricLabel">Homework Pending</div>
              </div>
              <div className="card tile">
                <div className="metricValue">0%</div>
                <div className="metricLabel">Attendance Rate</div>
              </div>
              <div className="card tile">
                <div className="metricValue">{childrenCards.length}</div>
                <div className="metricLabel">Total Children</div>
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

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
