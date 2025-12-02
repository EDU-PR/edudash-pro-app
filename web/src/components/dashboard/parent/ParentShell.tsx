'use client';

import { useMemo, useState, useEffect, useTransition, useRef } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MessageCircle,
  Users,
  LayoutDashboard,
  LogOut,
  Search,
  Bell,
  ArrowLeft,
  Settings,
  Menu,
  X,
  Sparkles,
  BookOpen,
  Clipboard,
  CreditCard,
  Megaphone,
  User,
  UserCircle2,
  ChevronDown,
  Phone,
} from 'lucide-react';
import { usePendingHomework } from '@/lib/hooks/parent/usePendingHomework';
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt';
import { useBackButton } from '@/hooks/useBackButton';
import { badgeManager } from '@/lib/utils/notification-badge';

interface ParentShellProps {
  tenantSlug?: string;
  userEmail?: string;
  userName?: string;
  preschoolName?: string;
  unreadCount?: number;
  hasOrganization?: boolean;
  children: React.ReactNode;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  hideHeader?: boolean;
}

export function ParentShell({ tenantSlug, userEmail, userName, preschoolName, unreadCount = 0, hasOrganization: hasOrganizationProp, children, contentClassName, contentStyle, hideHeader = false }: ParentShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const avatarLetter = useMemo(() => (userEmail?.[0] || 'U').toUpperCase(), [userEmail]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [hasOrganization, setHasOrganization] = useState(hasOrganizationProp || false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  // Get pending homework count
  const { count: homeworkCount } = usePendingHomework(userId || undefined);

  // Handle back button to prevent logout
  useBackButton({
    fallbackRoute: '/dashboard/parent',
    protectedRoutes: ['/dashboard/parent'],
  });

  // Show sidebar navigation for parent dashboard
  const showSidebar = true;

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!showProfileMenu) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    
    // Add listener with a small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  // Get user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, [supabase]);

  // Fetch unread notification count
  useEffect(() => {
    if (!userId) return;

    const fetchNotificationCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      setNotificationCount(count || 0);
      
      // Update app badge with notification count
      badgeManager.setUnreadNotifications(count || 0);
    };

    fetchNotificationCount();

    // Subscribe to real-time notification changes
    const channel = supabase
      .channel('notification-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // Auto-detect if user has organization (if not explicitly provided)
  useEffect(() => {
    if (hasOrganizationProp !== undefined) {
      setHasOrganization(hasOrganizationProp);
      return;
    }

    // Fetch user's preschool_id to determine if they're organization-linked
    const checkOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.id)
        .maybeSingle();

      setHasOrganization(!!profileData?.preschool_id);
    };

    checkOrganization();
  }, [supabase, hasOrganizationProp]);

  // Personalized navigation based on user type
  const nav = useMemo(() => {
    if (hasOrganization) {
      // Organization-linked parents see school-focused nav
      return [
        { href: '/dashboard/parent', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/parent/announcements', label: 'Announcements', icon: Megaphone },
        { href: '/dashboard/parent/messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
        { href: '/dashboard/parent/homework', label: 'Homework', icon: Clipboard, badge: homeworkCount },
        { href: '/dashboard/parent/children', label: 'My Children', icon: Users },
        { href: '/dashboard/parent/exam-prep', label: 'Exam Prep', icon: BookOpen },
        { href: '/dashboard/parent/payments', label: 'Payments', icon: CreditCard },
        { href: '/dashboard/parent/robotics', label: 'Robotics', icon: Sparkles },
        { href: '/dashboard/parent/settings', label: 'Settings', icon: Settings },
      ];
    } else {
      // Independent parents see learning-focused nav
      return [
        { href: '/dashboard/parent', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/dashboard/parent/messages?thread=dash-ai-assistant', label: 'Dash AI', icon: Sparkles },
        { href: '/dashboard/parent/homework', label: 'Homework', icon: Clipboard, badge: homeworkCount },
        { href: '/dashboard/parent/exam-prep', label: 'Exam Prep', icon: BookOpen },
        { href: '/dashboard/parent/robotics', label: 'Robotics', icon: Sparkles },
        { href: '/dashboard/parent/children', label: 'My Children', icon: Users },
        { href: '/dashboard/parent/settings', label: 'Settings', icon: Settings },
      ];
    }
  }, [hasOrganization, unreadCount, homeworkCount]);

  return (
    <div className="app">
      {!hideHeader && (
        <header className="topbar">
          <div className="topbarRow topbarEdge">
            <div className="leftGroup">
              <button 
                className="iconBtn mobile-nav-btn" 
                aria-label="Menu" 
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="icon20" />
              </button>
              
              {preschoolName ? (
                <div className="chip" style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '200px' }}>
                  <span style={{ fontSize: 16 }}>🦅</span>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preschoolName}
                  </span>
                </div>
              ) : (
                <div className="chip" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Young Eagles
                </div>
              )}
            </div>
            <div className="rightGroup" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="iconBtn"
                aria-label="Notifications"
                onClick={() => router.push('/dashboard/parent/notifications')}
                style={{ position: 'relative' }}
              >
                <Bell className="icon20" />
                {notificationCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      borderRadius: '50%',
                      width: 16,
                      height: 16,
                      fontSize: 10,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
              <div ref={profileMenuRef} style={{ position: 'relative' }}>
                <button 
                  className="avatar" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  style={{ cursor: 'pointer', border: 'none', background: 'inherit' }}
                  aria-label="Profile menu"
                >
                  {avatarLetter}
                </button>
                
                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 200,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}>
                    {/* User Info */}
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {userName || 'Parent'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {userEmail}
                      </div>
                    </div>

                    {/* Menu Items */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileMenu(false);
                        router.push('/dashboard/parent/children');
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
                      <Users size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        My Children
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileMenu(false);
                        router.push('/dashboard/parent/settings');
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
                      <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Settings
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileMenu(false);
                        router.push('/dashboard/parent/settings/ringtones');
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
                      <Phone size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        Ringtones
                      </span>
                    </button>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setShowProfileMenu(false);
                        await supabase.auth.signOut();
                        router.push('/sign-in');
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--danger-light, #fee2e2)';
                        e.currentTarget.style.color = 'var(--danger, #ef4444)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'inherit';
                      }}
                    >
                      <LogOut size={16} style={{ color: 'var(--danger, #ef4444)' }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        Sign Out
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="frame">
        {showSidebar && (
          <aside className="sidenav sticky" aria-label="Sidebar">
            <div className="sidenavCol">
              <nav className="nav">
                {nav.map((it) => {
                  const Icon = it.icon as any;
                  const active = pathname === it.href || pathname?.startsWith(it.href + '/');
                  return (
                    <Link key={it.href} href={it.href} className={`navItem ${active ? 'navItemActive' : ''}`} aria-current={active ? 'page' : undefined}>
                      <Icon className="navIcon" />
                      <span>{it.label}</span>
                      {typeof it.badge === 'number' && it.badge > 0 && (
                        <span className="navItemBadge badgeNumber">{it.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <div className="sidenavFooter">
                <button
                  className="navItem"
                  onClick={async () => { await supabase.auth.signOut(); router.push('/sign-in'); }}
                >
                  <LogOut className="navIcon" />
                  <span>Sign out</span>
                </button>
                <div className="brandPill w-full text-center">Powered by Young Eagles</div>
              </div>
            </div>
          </aside>
        )}

        <main className={`content ${contentClassName ?? ''}`} style={contentStyle}>
          {children}
        </main>
      </div>

      {/* Mobile Navigation Drawer (Left Sidebar) */}
      {mobileNavOpen && (
        <>
          <div 
            className="mobile-nav-overlay"
            onClick={() => setMobileNavOpen(false)}
          />
          <div 
            className="mobile-nav-drawer"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Menu</h3>
              <button 
                onClick={() => setMobileNavOpen(false)}
                className="iconBtn"
                aria-label="Close"
              >
                <X className="icon20" />
              </button>
            </div>
            
            {/* Navigation Links */}
            <nav className="nav" style={{ display: 'grid', gap: 6 }}>
              {nav.map((it) => {
                const Icon = it.icon as any;
                const active = pathname === it.href || pathname?.startsWith(it.href + '/');
                return (
                  <button 
                    key={it.href} 
                    className={`navItem ${active ? 'navItemActive' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[ParentShell] Navigating to:', it.href);
                      // Close drawer immediately
                      setMobileNavOpen(false);
                      // Navigate after a tiny delay to ensure drawer animation starts
                      requestAnimationFrame(() => {
                        router.push(it.href);
                      });
                    }}
                    style={{ width: '100%' }}
                  >
                    <Icon className="navIcon" />
                    <span>{it.label}</span>
                    {typeof it.badge === 'number' && it.badge > 0 && (
                      <span className="navItemBadge badgeNumber">{it.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            
            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
              <button
                className="navItem"
                style={{ width: '100%' }}
                onClick={async () => { 
                  await supabase.auth.signOut(); 
                  router.push('/sign-in'); 
                }}
              >
                <LogOut className="navIcon" />
                <span>Sign out</span>
              </button>
              <div className="brandPill" style={{ marginTop: 'var(--space-2)', width: '100%', textAlign: 'center' }}>Powered by Young Eagles</div>
            </div>
          </div>
        </>
      )}

      {/* Push Notification Prompt */}
      <PushNotificationPrompt />

      <style jsx global>{`
        /* Mobile nav button - hidden by default on desktop */
        .mobile-nav-btn {
          display: none;
        }
        
        /* Mobile overlay - visible when rendered */
        .mobile-nav-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 9998;
        }
        
        /* Mobile drawer - visible when rendered */
        .mobile-nav-drawer {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 80%;
          max-width: 320px;
          background: var(--surface-1);
          z-index: 9999;
          overflow-y: auto;
          padding: var(--space-4);
          animation: slideInLeft 0.3s ease-out;
        }
        
        @media (max-width: 1023px) {
          /* Show mobile navigation button on mobile */
          .mobile-nav-btn {
            display: grid !important;
          }
          /* Hide desktop back button on mobile, use hamburger instead */
          .desktop-back-btn {
            display: none !important;
          }
        }
        
        /* Full width layout when sidebar is hidden */
        .frame-no-sidebar {
          grid-template-columns: 1fr !important;
        }
        
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
