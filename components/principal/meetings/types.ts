// Types for Principal Meetings

export interface Meeting {
  id: string;
  title: string;
  description: string;
  meeting_type: MeetingType;
  meeting_date: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  location?: string;
  is_virtual: boolean;
  virtual_link?: string;
  agenda_items: AgendaItem[];
  status: MeetingStatus;
  minutes?: string;
  action_items: ActionItem[];
  created_at: string;
}

export type MeetingType = 
  | 'staff' | 'parent' | 'governing_body' | 'pta' | 'curriculum' 
  | 'safety' | 'budget' | 'training' | 'one_on_one' | 'other';

export type MeetingStatus = 
  | 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';

export interface AgendaItem {
  title: string;
  duration_minutes?: number;
  presenter?: string;
}

export interface ActionItem {
  task: string;
  assignee_id?: string;
  due_date?: string;
  status?: string;
}

export interface MeetingFormData {
  title: string;
  description: string;
  meeting_type: MeetingType;
  meeting_date: Date;
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
  location: string;
  is_virtual: boolean;
  virtual_link: string;
  agenda_items: AgendaItem[];
  status: MeetingStatus;
}

export interface MeetingTypeInfo {
  value: MeetingType;
  label: string;
  icon: string;
  color: string;
}

export const MEETING_TYPES: MeetingTypeInfo[] = [
  { value: 'staff', label: 'Staff Meeting', icon: 'people', color: '#3B82F6' },
  { value: 'parent', label: 'Parent Meeting', icon: 'people-circle', color: '#10B981' },
  { value: 'governing_body', label: 'Governing Body', icon: 'business', color: '#8B5CF6' },
  { value: 'pta', label: 'PTA Meeting', icon: 'hand-left', color: '#F59E0B' },
  { value: 'curriculum', label: 'Curriculum Meeting', icon: 'book', color: '#EC4899' },
  { value: 'safety', label: 'Safety Meeting', icon: 'shield-checkmark', color: '#EF4444' },
  { value: 'budget', label: 'Budget Meeting', icon: 'calculator', color: '#14B8A6' },
  { value: 'training', label: 'Training Session', icon: 'school', color: '#6366F1' },
  { value: 'one_on_one', label: 'One-on-One', icon: 'person', color: '#64748B' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#94A3B8' },
];

export const STATUS_COLORS: Record<MeetingStatus, string> = {
  draft: '#6b7280',
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
  rescheduled: '#8b5cf6',
};

export const getMeetingTypeInfo = (type: string): MeetingTypeInfo => {
  return MEETING_TYPES.find(t => t.value === type) || MEETING_TYPES[9];
};

export const formatMeetingDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatMeetingTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};
