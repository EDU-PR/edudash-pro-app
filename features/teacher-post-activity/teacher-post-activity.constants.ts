/**
 * Teacher Post Activity Screen - Constants & Types
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  class_id?: string;
}

export interface Class {
  id: string;
  name: string;
}

export type ActivityType =
  | 'learning' | 'play' | 'meal' | 'rest' | 'special'
  | 'milestone' | 'outdoor' | 'art' | 'music' | 'story' | 'social';

export type Visibility = 'parent_only' | 'class_parents' | 'all_parents' | 'private';

// ── Activity Types ─────────────────────────────────────────────────────────

export const ACTIVITY_TYPES: { type: ActivityType; icon: string; color: string; label: string }[] = [
  { type: 'learning', icon: 'school', color: '#3B82F6', label: 'Learning' },
  { type: 'play', icon: 'game-controller', color: '#10B981', label: 'Play' },
  { type: 'meal', icon: 'restaurant', color: '#EF4444', label: 'Meal' },
  { type: 'rest', icon: 'moon', color: '#6366F1', label: 'Rest' },
  { type: 'art', icon: 'color-palette', color: '#EC4899', label: 'Art' },
  { type: 'music', icon: 'musical-notes', color: '#8B5CF6', label: 'Music' },
  { type: 'story', icon: 'book', color: '#0EA5E9', label: 'Story' },
  { type: 'outdoor', icon: 'sunny', color: '#F59E0B', label: 'Outdoor' },
  { type: 'special', icon: 'star', color: '#F97316', label: 'Special' },
  { type: 'milestone', icon: 'trophy', color: '#EAB308', label: 'Milestone' },
  { type: 'social', icon: 'people', color: '#06B6D4', label: 'Social' },
];

// ── Templates ──────────────────────────────────────────────────────────────

export const TEMPLATES: Record<ActivityType, string[]> = {
  learning: [
    'We practiced counting and number recognition today',
    'Learning about colors and shapes',
    'Working on letter recognition and phonics',
  ],
  play: [
    'Had fun with building blocks and imagination',
    'Enjoyed outdoor playtime with friends',
    'Played educational games together',
  ],
  meal: [
    'Enjoyed a healthy lunch together',
    'Snack time - practicing table manners',
    'Great job trying new foods today!',
  ],
  rest: [
    'Peaceful nap time',
    'Quiet time with books',
    'Rest and relaxation',
  ],
  art: [
    'Creative art project completed',
    'Painting and drawing time',
    'Exploring different art materials',
  ],
  music: [
    'Music and movement activities',
    'Learning new songs together',
    'Dance and rhythm time',
  ],
  story: [
    'Story time - enjoyed a wonderful book',
    'Reading and comprehension activities',
    'Interactive storytelling session',
  ],
  outdoor: [
    'Outdoor exploration and nature walk',
    'Playing outside and enjoying fresh air',
    'Physical activities and games',
  ],
  special: [
    'Special activity today!',
    'Field trip and adventure',
    'Guest visitor presentation',
  ],
  milestone: [
    'Achieved a new milestone today!',
    'Great progress observed',
    'Wonderful development moment',
  ],
  social: [
    'Practicing sharing and taking turns',
    'Working together as a team',
    'Making new friends and social skills',
  ],
};
