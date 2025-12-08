'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, FileText, BarChart3, MessageCircle, Calendar, DollarSign,
  Users, GraduationCap, Sparkles, Search, Settings, Home, Target,
  Lightbulb, Award, Zap, MapPin, Library, FileCheck, Bot, Phone, Video, ChevronDown
} from 'lucide-react';
import { QuickCallModal } from '@/components/calls/QuickCallModal';

interface QuickAction {
  icon: any;
  label: string;
  href: string;
  color: string;
}

interface QuickActionsGridProps {
  usageType?: 'preschool' | 'k12_school' | 'homeschool' | 'aftercare' | 'supplemental' | 'exploring' | 'independent';
  hasOrganization: boolean;
  activeChildGrade?: number;
  isExamEligible?: boolean;
  unreadCount?: number;
  homeworkCount?: number;
  userId?: string;
  preschoolId?: string;
}

export function QuickActionsGrid({ usageType, hasOrganization, activeChildGrade = 0, isExamEligible = false, unreadCount = 0, homeworkCount = 0, userId, preschoolId }: QuickActionsGridProps) {
  const router = useRouter();
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [showQuickCallModal, setShowQuickCallModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMessagesDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getQuickActions = (): QuickAction[] => {
    // Organization-linked actions (common for all with organization)
    const organizationActions: QuickAction[] = hasOrganization ? [
      { icon: MessageCircle, label: 'Messages', href: '/dashboard/parent/messages', color: '#8b5cf6' },
      { icon: FileText, label: 'Homework', href: '/dashboard/parent/homework', color: '#f59e0b' },
      { icon: Calendar, label: 'Calendar', href: '/dashboard/parent/calendar', color: '#06b6d4' },
      { icon: BarChart3, label: 'Progress', href: '/dashboard/parent/progress', color: '#10b981' },
      { icon: Library, label: 'E-Books', href: '/dashboard/parent/ebooks', color: '#3b82f6' },
      { icon: Bot, label: 'Robotics Lab', href: '/dashboard/parent/robotics', color: '#f59e0b' },
      ...(isExamEligible ? [
        { icon: Target, label: 'Exam Prep', href: '/dashboard/parent/generate-exam', color: '#10b981' },
        { icon: FileCheck, label: 'My Exams', href: '/dashboard/parent/my-exams', color: '#0ea5e9' },
      ] : []),
      { icon: DollarSign, label: 'Payments', href: '/dashboard/parent/payments', color: '#f59e0b' },
      { icon: Users, label: 'My Children', href: '/dashboard/parent/children', color: '#8b5cf6' },
      { icon: Sparkles, label: 'Chat with Dash', href: '/dashboard/parent/dash-chat', color: '#ec4899' },
    ] : [];

    // Independent parents - grade-appropriate actions
    if (!hasOrganization) {
      const baseActions = [
        { icon: Users, label: 'My Children', href: '/dashboard/parent/children', color: '#8b5cf6' },
        { icon: Sparkles, label: 'Chat with Dash', href: '/dashboard/parent/dash-chat', color: '#ec4899' },
        { icon: Bot, label: 'Robotics Lab', href: '/dashboard/parent/robotics', color: '#f59e0b' },
        { icon: Library, label: 'E-Books', href: '/dashboard/parent/ebooks', color: '#06b6d4' },
      ];

      // Grade 4+ gets exam features
      if (isExamEligible) {
        baseActions.push(
          { icon: Target, label: 'Exam Prep', href: '/dashboard/parent/exam-prep', color: '#10b981' },
          { icon: FileCheck, label: 'My Exams', href: '/dashboard/parent/my-exams', color: '#0ea5e9' }
        );
      }

      // All grades get these
      baseActions.push(
        { icon: BookOpen, label: 'Lessons', href: '/dashboard/parent/lessons', color: '#10b981' },
        { icon: BarChart3, label: 'Progress', href: '/dashboard/parent/progress', color: '#06b6d4' },
        { icon: Settings, label: 'Settings', href: '/dashboard/parent/settings', color: '#6366f1' }
      );

      return baseActions;
    }
    
    // Organization-linked parents (k12, preschool, aftercare)
    return organizationActions;
  };

  const actions = getQuickActions();

  return (
    <div className="section">
      <div className="sectionTitle">Quick Actions</div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}
      className="quick-actions-grid"
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const isChatWithDash = action.label === 'Chat with Dash';
          const isMessages = action.label === 'Messages';
          const isHomework = action.label === 'Homework';
          const hasUnread = isMessages && unreadCount > 0;
          const hasPendingHomework = isHomework && homeworkCount > 0;
          const badgeCount = isMessages ? unreadCount : isHomework ? homeworkCount : 0;
          const showBadge = hasUnread || hasPendingHomework;
          
          // Messages button gets special dropdown treatment
          if (isMessages) {
            return (
              <div key={action.href} ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMessagesDropdown(!showMessagesDropdown)}
                  className="qa"
                  style={{
                    background: 'var(--surface-1)',
                    border: hasUnread
                      ? '2px solid #8b5cf6'
                      : '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                    minHeight: '120px',
                    boxShadow: hasUnread
                      ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 20px rgba(139, 92, 246, 0.4)'
                      : 'none',
                    position: 'relative',
                    animation: hasUnread ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 8px 24px ${action.color}22`;
                    e.currentTarget.style.borderColor = action.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = hasUnread ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 20px rgba(139, 92, 246, 0.4)' : 'none';
                    e.currentTarget.style.borderColor = hasUnread ? '#8b5cf6' : 'var(--border)';
                  }}
                >
                  {hasUnread && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                      zIndex: 1,
                    }}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </div>
                  )}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: `${action.color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={24} style={{ color: action.color }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ 
                      fontSize: 14, 
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}>
                      {action.label}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                </button>
                
                {/* Dropdown Menu */}
                {showMessagesDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 8,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => {
                        setShowMessagesDropdown(false);
                        router.push('/dashboard/parent/messages');
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <MessageCircle size={18} style={{ color: '#8b5cf6' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Go to Messages
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMessagesDropdown(false);
                        setShowQuickCallModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Phone size={18} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Voice Call
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setShowMessagesDropdown(false);
                        setShowQuickCallModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Video size={18} style={{ color: '#3b82f6' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Video Call
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          }
          
          // Regular button for other actions
          return (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="qa"
              style={{
                background: isChatWithDash 
                  ? 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)'
                  : 'var(--surface-1)',
                border: (hasUnread || hasPendingHomework)
                  ? '2px solid #8b5cf6'
                  : isChatWithDash
                  ? '2px solid #ec4899'
                  : '1px solid var(--border)',
                borderRadius: 12,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                minHeight: '120px',
                boxShadow: (hasUnread || hasPendingHomework)
                  ? '0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 20px rgba(139, 92, 246, 0.4)'
                  : isChatWithDash 
                  ? '0 4px 20px rgba(236, 72, 153, 0.5)' 
                  : 'none',
                position: 'relative',
                animation: (hasUnread || hasPendingHomework) ? 'pulse-glow 2s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                if (isChatWithDash) {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(236, 72, 153, 0.6)';
                } else {
                  e.currentTarget.style.boxShadow = `0 8px 24px ${action.color}22`;
                  e.currentTarget.style.borderColor = action.color;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                if (isChatWithDash) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(236, 72, 153, 0.5)';
                } else {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              {(hasUnread || hasPendingHomework) && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
                  zIndex: 1,
                }}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </div>
              )}
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: isChatWithDash ? 'rgba(255, 255, 255, 0.2)' : `${action.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={24} style={{ color: isChatWithDash ? 'white' : action.color }} />
              </div>
              <span style={{ 
                fontSize: 14, 
                fontWeight: 600,
                color: isChatWithDash ? 'white' : 'var(--text-primary)'
              }}>
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Quick Call Modal */}
      <QuickCallModal
        isOpen={showQuickCallModal}
        onClose={() => setShowQuickCallModal(false)}
        onVoiceCall={(recipientId, recipientName) => {
          setShowQuickCallModal(false);
          // Navigate to messages page which has the CallProvider
          router.push('/dashboard/parent/messages');
          // Use setTimeout to ensure navigation completes, then trigger call
          setTimeout(() => {
            // Dispatch custom event to trigger call from messages page
            window.dispatchEvent(new CustomEvent('triggerCall', {
              detail: { recipientId, recipientName, type: 'voice' }
            }));
          }, 500);
        }}
        onVideoCall={(recipientId, recipientName) => {
          setShowQuickCallModal(false);
          // Navigate to messages page which has the CallProvider
          router.push('/dashboard/parent/messages');
          // Use setTimeout to ensure navigation completes, then trigger call
          setTimeout(() => {
            // Dispatch custom event to trigger call from messages page
            window.dispatchEvent(new CustomEvent('triggerCall', {
              detail: { recipientId, recipientName, type: 'video' }
            }));
          }, 500);
        }}
        currentUserId={userId}
        preschoolId={preschoolId}
      />

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2), 0 4px 20px rgba(139, 92, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 0 5px rgba(139, 92, 246, 0.3), 0 6px 30px rgba(139, 92, 246, 0.6);
          }
        }
        
        @media (min-width: 640px) {
          .quick-actions-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .quick-actions-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
