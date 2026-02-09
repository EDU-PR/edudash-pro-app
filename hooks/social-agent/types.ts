/**
 * Social Agent types, utilities, and option constants.
 * Extracted from principal-social-agent.tsx for WARP.md compliance.
 */

export type AutopostSchedule = 'mon_wed_fri' | 'weekdays' | 'daily' | 'off';
export type SocialCategory =
  | 'word_of_day'
  | 'study_tip'
  | 'parent_tip'
  | 'value_of_week'
  | 'school_update'
  | 'custom';

export type SocialConnection = {
  id: string;
  platform: 'facebook_page';
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialPost = {
  id: string;
  category: SocialCategory;
  status: string;
  content: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
  created_at: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function normalizeTimeHHMMToHHMMSS(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '08:00:00';
  const parts = raw.split(':').map((p) => p.trim());
  const hour = Math.max(0, Math.min(23, Number(parts[0] || 8)));
  const min = Math.max(0, Math.min(59, Number(parts[1] || 0)));
  const sec = Math.max(0, Math.min(59, Number((parts[2] || '0').split('.')[0] || 0)));
  if (Number.isNaN(hour) || Number.isNaN(min) || Number.isNaN(sec)) return '08:00:00';
  return `${pad2(hour)}:${pad2(min)}:${pad2(sec)}`;
}

export const SCHEDULE_OPTIONS: Array<{ id: AutopostSchedule; label: string; hint: string }> = [
  { id: 'mon_wed_fri', label: 'Mon/Wed/Fri', hint: 'Light posting' },
  { id: 'weekdays', label: 'Weekdays', hint: 'School days' },
  { id: 'daily', label: 'Daily', hint: 'Every day' },
  { id: 'off', label: 'Off', hint: 'No autopost' },
];

export const CATEGORY_OPTIONS: Array<{ id: SocialCategory; label: string; hint: string }> = [
  { id: 'study_tip', label: 'Study Tip', hint: 'Quick learning tip' },
  { id: 'parent_tip', label: 'Parent Tip', hint: 'Support at home' },
  { id: 'word_of_day', label: 'Word of Day', hint: 'Vocabulary' },
  { id: 'value_of_week', label: 'Value of Week', hint: 'Character focus' },
  { id: 'school_update', label: 'School Update', hint: 'Needs approval' },
  { id: 'custom', label: 'Custom', hint: 'Use context' },
];
