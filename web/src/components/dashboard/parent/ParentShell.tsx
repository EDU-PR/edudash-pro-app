'use client';

import { useMemo, useState, useEffect } from 'react';
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
  
  // Get pending homework count
  const { count: homeworkCount } = usePendingHomework(userId || undefined);

  // Handle back button to prevent logout
  useBackButton({
    fallbackRoute: '/dashboard/parent',
    protectedRoutes: ['/dashboard/parent'],
  });

  // Show sidebar navigation for parent dashboard
  const showSidebar = true;

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
              <div className="avatar">{avatarLetter}</div>
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
                  <Link 
                    key={it.href} 
                    href={it.href}
                    className={`navItem ${active ? 'navItemActive' : ''}`}
                    onClick={() => setMobileNavOpen(false)}
                    style={{ width: '100%', textDecoration: 'none' }}
                  >
                    <Icon className="navIcon" />
                    <span>{it.label}</span>
                    {typeof it.badge === 'number' && it.badge > 0 && (
                      <span className="navItemBadge badgeNumber">{it.badge}</span>
                    )}
                  </Link>
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
