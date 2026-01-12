// Types and constants for activity builder

export type ActivityType = 'matching' | 'counting' | 'sorting' | 'sequence' | 'quiz';

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface CountingItem {
  id: string;
  emoji: string;
  count: number;
}

export interface ActivityDraft {
  type: ActivityType;
  title: string;
  instructions: string;
  difficulty: number;
  ageGroupMin: number;
  ageGroupMax: number;
  starsReward: number;
  subject: string;
  pairs?: MatchPair[];
  countingItems?: CountingItem[];
}

export interface ActivityTypeConfig {
  type: ActivityType;
  icon: string;
  name: string;
  description: string;
}

export const ACTIVITY_TYPES: ActivityTypeConfig[] = [
  {
    type: 'matching',
    icon: '🔀',
    name: 'Matching Game',
    description: 'Match items together (animals & sounds, colors & objects)',
  },
  {
    type: 'counting',
    icon: '🔢',
    name: 'Counting Game',
    description: 'Count objects and select the right number',
  },
  {
    type: 'sorting',
    icon: '📊',
    name: 'Sorting Game',
    description: 'Put items in order (size, sequence)',
  },
  {
    type: 'sequence',
    icon: '1️⃣',
    name: 'Sequence Game',
    description: 'Arrange events in the correct order',
  },
  {
    type: 'quiz',
    icon: '❓',
    name: 'Quiz',
    description: 'Multiple choice questions',
  },
];

export const SUBJECTS = ['math', 'language', 'science', 'art', 'social'];

export const EMOJI_PICKER = [
  '🐕', '🐱', '🐦', '🐘', '🦋', '🌸', '☀️', '🌈', 
  '⭐', '❤️', '🍎', '🍌', '🎈', '🚗', '🏠', '🎂'
];

export const getSkillsForType = (type: ActivityType): string[] => {
  const skills: Record<ActivityType, string[]> = {
    matching: ['memory', 'matching', 'recognition'],
    counting: ['counting', 'numbers', 'math'],
    sorting: ['sorting', 'comparison', 'logic'],
    sequence: ['sequence', 'order', 'logic'],
    quiz: ['knowledge', 'recall', 'learning'],
  };
  return skills[type] || [];
};

export const createInitialDraft = (): ActivityDraft => ({
  type: 'matching',
  title: '',
  instructions: '',
  difficulty: 1,
  ageGroupMin: 3,
  ageGroupMax: 5,
  starsReward: 2,
  subject: 'math',
  pairs: [],
  countingItems: [],
});
