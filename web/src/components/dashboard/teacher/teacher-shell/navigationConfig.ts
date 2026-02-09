/**
 * Teacher Navigation Configuration
 * Expanded for feature parity with mobile teacherRoutes.ts
 */

import {
  MessageCircle,
  Users,
  LayoutDashboard,
  Settings,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  BarChart3,
  Video,
  CheckSquare,
  Calendar,
  Users2,
  Phone,
  FileText,
  Star,
  Gift,
  Home,
} from 'lucide-react';
import type { NavItem } from './types';

export interface NavSection {
  label: string;
  items: NavItem[];
}

export function getTeacherNavItems(unreadCount: number = 0): NavItem[] {
  // Flat list for backward compatibility — used by sidebar/mobile nav
  return getTeacherNavSections(unreadCount).flatMap((s) => s.items);
}

/**
 * Grouped nav sections — mirrors mobile category grouping
 */
export function getTeacherNavSections(unreadCount: number = 0): NavSection[] {
  return [
    {
      label: 'Overview',
      items: [
        { href: '/dashboard/teacher', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Lessons & Activities',
      items: [
        { href: '/dashboard/teacher/lessons', label: 'Lesson Plans', icon: BookOpen },
        { href: '/dashboard/teacher/assignments', label: 'Assignments', icon: ClipboardCheck },
        { href: '/dashboard/teacher/homework', label: 'Homework', icon: FileText },
      ],
    },
    {
      label: 'Classroom',
      items: [
        { href: '/dashboard/teacher/classes', label: 'My Classes', icon: Users },
        { href: '/dashboard/teacher/attendance', label: 'Attendance', icon: CheckSquare },
        { href: '/dashboard/teacher/live-lesson', label: 'Live Lesson', icon: Video },
        { href: '/dashboard/teacher/birthdays', label: 'Birthday Chart', icon: Gift },
      ],
    },
    {
      label: 'Communication',
      items: [
        { href: '/dashboard/teacher/messages', label: 'Messages', icon: MessageCircle, badge: unreadCount },
        { href: '/dashboard/teacher/groups', label: 'Groups', icon: Users2 },
        { href: '/dashboard/teacher/calls', label: 'Calls', icon: Phone },
      ],
    },
    {
      label: 'AI Tools',
      items: [
        { href: '/dashboard/teacher/ai-assistant', label: 'AI Assistant', icon: Sparkles },
        { href: '/dashboard/teacher/ai-grader', label: 'Homework Grader', icon: ClipboardCheck },
      ],
    },
    {
      label: 'Reports & Analytics',
      items: [
        { href: '/dashboard/teacher/reports', label: 'Student Reports', icon: BarChart3 },
        { href: '/dashboard/teacher/family-review', label: 'Family Activity', icon: Home },
        { href: '/dashboard/teacher/reputation', label: 'My Reputation', icon: Star },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/dashboard/teacher/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];
}
