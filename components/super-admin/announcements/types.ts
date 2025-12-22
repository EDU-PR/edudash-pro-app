/**
 * Types and constants for the Super Admin Announcements feature
 */

// Announcement type enum
export type AnnouncementType = 'info' | 'warning' | 'alert' | 'maintenance' | 'feature';

// Priority enum
export type AnnouncementPriority = 'low' | 'medium' | 'high' | 'urgent';

// Target audience enum  
export type TargetAudience = 'all' | 'principals' | 'teachers' | 'parents' | 'specific_schools';

// Platform announcement interface
export interface PlatformAnnouncement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  target_audience: TargetAudience;
  target_schools: string[];
  is_active: boolean;
  is_pinned: boolean;
  show_banner: boolean;
  scheduled_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  views_count: number;
  click_count: number;
}

// Announcement form state
export interface AnnouncementForm {
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  target_audience: TargetAudience;
  target_schools: string[];
  is_active: boolean;
  is_pinned: boolean;
  show_banner: boolean;
  scheduled_at?: string;
  expires_at?: string;
}

// Constants
export const ANNOUNCEMENT_TYPES: AnnouncementType[] = ['info', 'warning', 'alert', 'maintenance', 'feature'];
export const PRIORITIES: AnnouncementPriority[] = ['low', 'medium', 'high', 'urgent'];
export const AUDIENCES: TargetAudience[] = ['all', 'principals', 'teachers', 'parents', 'specific_schools'];

// Initial form state
export const INITIAL_FORM_STATE: AnnouncementForm = {
  title: '',
  content: '',
  type: 'info',
  priority: 'medium',
  target_audience: 'all',
  target_schools: [],
  is_active: true,
  is_pinned: false,
  show_banner: false,
};
