/**
 * Teacher Navigation Configuration
 * Extracted from TeacherShell.tsx
 */

import {
  MessageCircle,
  Users,
  LayoutDashboard,
  Settings,
  BookOpen,
  ClipboardCheck,
  BookMarked,
} from 'lucide-react';
import type { NavItem } from './types';

export function getTeacherNavItems(unreadCount: number = 0): NavItem[] {
  return [
    { href: '/dashboard/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/teacher/classes', label: 'My Classes', icon: Users },
    { href: '/dashboard/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/dashboard/teacher/lessons', label: 'Lesson Plans', icon: BookOpen },
    { href: '/dashboard/teacher/messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
    { href: '/admin/caps-mapping', label: 'CAPS Mapping', icon: BookMarked },
    { href: '/dashboard/teacher/settings', label: 'Settings', icon: Settings },
  ];
}
