// Types for Principal Activities

export interface ActivityTemplate {
  id: string;
  title: string;
  description: string;
  activity_type: ActivityType;
  age_groups: string[];
  developmental_domains: string[];
  learning_objectives: string[];
  materials_needed: string[];
  duration_minutes: number;
  group_size?: string;
  activity_steps: ActivityStep[];
  theme_tags: string[];
  is_published: boolean;
  is_featured: boolean;
  usage_count: number;
  preschool_id?: string;
  created_at: string;
}

export type ActivityType = 
  | 'art' | 'music' | 'movement' | 'story' | 'dramatic_play' | 'sensory'
  | 'outdoor' | 'construction' | 'science' | 'math' | 'literacy' | 'life_skills' | 'other';

export interface ActivityStep {
  step_number: number;
  description: string;
  duration?: number;
}

export interface ActivityFormData {
  title: string;
  description: string;
  activity_type: ActivityType;
  age_groups: string[];
  developmental_domains: string[];
  learning_objectives: string[];
  materials_needed: string[];
  duration_minutes: number;
  group_size: string;
  activity_steps: ActivityStep[];
  theme_tags: string[];
  is_published: boolean;
}

export interface ActivityTypeInfo {
  value: ActivityType;
  label: string;
  icon: string;
  color: string;
}

export interface DevelopmentalDomain {
  value: string;
  label: string;
  color: string;
}

export const ACTIVITY_TYPES: ActivityTypeInfo[] = [
  { value: 'art', label: 'Art & Craft', icon: 'color-palette', color: '#EC4899' },
  { value: 'music', label: 'Music', icon: 'musical-notes', color: '#8B5CF6' },
  { value: 'movement', label: 'Movement', icon: 'body', color: '#F59E0B' },
  { value: 'story', label: 'Story Time', icon: 'book', color: '#3B82F6' },
  { value: 'dramatic_play', label: 'Dramatic Play', icon: 'people', color: '#10B981' },
  { value: 'sensory', label: 'Sensory', icon: 'hand-left', color: '#06B6D4' },
  { value: 'outdoor', label: 'Outdoor', icon: 'sunny', color: '#22C55E' },
  { value: 'construction', label: 'Construction', icon: 'cube', color: '#EF4444' },
  { value: 'science', label: 'Science', icon: 'flask', color: '#6366F1' },
  { value: 'math', label: 'Math', icon: 'calculator', color: '#14B8A6' },
  { value: 'literacy', label: 'Literacy', icon: 'text', color: '#F97316' },
  { value: 'life_skills', label: 'Life Skills', icon: 'home', color: '#64748B' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#94A3B8' },
];

export const DEVELOPMENTAL_DOMAINS: DevelopmentalDomain[] = [
  { value: 'cognitive', label: 'Cognitive', color: '#3B82F6' },
  { value: 'physical', label: 'Physical', color: '#22C55E' },
  { value: 'social', label: 'Social', color: '#EC4899' },
  { value: 'emotional', label: 'Emotional', color: '#F59E0B' },
  { value: 'language', label: 'Language', color: '#8B5CF6' },
];

export const GROUP_SIZES = [
  { value: 'individual', label: 'Individual' },
  { value: 'small_group', label: 'Small Group (2-5)' },
  { value: 'large_group', label: 'Large Group (6-12)' },
  { value: 'whole_class', label: 'Whole Class' },
];

export const getActivityTypeInfo = (type: string): ActivityTypeInfo => {
  return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[12];
};

export const getInitialActivityFormData = (): ActivityFormData => ({
  title: '',
  description: '',
  activity_type: 'art',
  age_groups: ['3-6'],
  developmental_domains: [],
  learning_objectives: [],
  materials_needed: [],
  duration_minutes: 30,
  group_size: 'small_group',
  activity_steps: [],
  theme_tags: [],
  is_published: true,
});
