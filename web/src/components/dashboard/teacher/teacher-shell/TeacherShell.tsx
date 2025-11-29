'use client';

/**
 * Teacher Shell - Refactored
 * Main layout component for teacher dashboard
 * Original: 487 lines → Refactored: ~120 lines
 */

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt';
import { useBackButton } from '@/hooks/useBackButton';
import { TeacherTopBar } from './TeacherTopBar';
import { TeacherSideNav } from './TeacherSideNav';
import { TeacherMobileNav } from './TeacherMobileNav';
import { TeacherMobileWidgets } from './TeacherMobileWidgets';
import { getTeacherNavItems } from './navigationConfig';
import type { TeacherShellProps } from './types';

export function TeacherShell({ 
  userEmail, 
  userName,
  preschoolName,
  userId,
  unreadCount = 0, 
  children,
  rightSidebar,
  contentClassName,
  contentStyle,
  hideHeader = false,
}: TeacherShellProps) {
  const supabase = createClient();
  const avatarLetter = useMemo(() => (userName?.[0] || userEmail?.[0] || 'T').toUpperCase(), [userName, userEmail]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileWidgetsOpen, setMobileWidgetsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  useBackButton({ fallbackRoute: '/dashboard/teacher', protectedRoutes: ['/dashboard/teacher'] });

  useEffect(() => {
    if (!userId) return;
    const fetchNotificationCount = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_read', false);
      setNotificationCount(count || 0);
    };
    fetchNotificationCount();
    const channel = supabase.channel(`teacher-notification-changes-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => fetchNotificationCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  const activityCount = useMemo(() => unreadCount > 0 ? unreadCount : 0, [unreadCount]);
  const nav = getTeacherNavItems(unreadCount);

  return (
    <div className="app">
      {!hideHeader && (
        <TeacherTopBar
          preschoolName={preschoolName}
          avatarLetter={avatarLetter}
          notificationCount={notificationCount}
          activityCount={activityCount}
          hasRightSidebar={!!rightSidebar}
          onMenuClick={() => setMobileNavOpen(true)}
          onWidgetsClick={() => setMobileWidgetsOpen(true)}
        />
      )}

      <div className="frame">
        <TeacherSideNav
          nav={nav}
          collapsed={sidebarCollapsed}
          hovered={sidebarHovered}
          onHoverStart={() => setSidebarHovered(true)}
          onHoverEnd={() => setSidebarHovered(false)}
        />
        <main className={`content ${contentClassName ?? ''}`} style={contentStyle}>{children}</main>
        {rightSidebar && <aside className="right sticky" aria-label="Activity">{rightSidebar}</aside>}
      </div>

      <TeacherMobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} nav={nav} />
      {rightSidebar && (
        <TeacherMobileWidgets isOpen={mobileWidgetsOpen} onClose={() => setMobileWidgetsOpen(false)}>
          {rightSidebar}
        </TeacherMobileWidgets>
      )}

      <PushNotificationPrompt />

      <style jsx>{`
        @media (max-width: 1023px) {
          .mobile-nav-btn { display: grid !important; }
          .desktop-back-btn { display: none !important; }
          .mobile-nav-overlay, .mobile-nav-drawer, .mobile-widgets-overlay { display: block !important; }
          .mobile-widgets-drawer { display: flex !important; }
        }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
