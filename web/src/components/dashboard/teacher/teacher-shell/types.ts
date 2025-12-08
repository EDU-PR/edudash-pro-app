/**
 * Teacher Shell Types
 */

import type { CSSProperties } from 'react';

export interface TeacherShellProps {
  tenantSlug?: string;
  userEmail?: string;
  userName?: string;
  preschoolName?: string;
  preschoolId?: string;
  userId?: string;
  unreadCount?: number;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
  onOpenDashAI?: () => void;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  hideHeader?: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: number;
}
