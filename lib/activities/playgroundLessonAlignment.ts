import { PRESCHOOL_ACTIVITIES } from './preschoolActivities.data';
import type { LearningDomain, PreschoolActivity } from './preschoolActivities.types';

export interface PlaygroundLessonContext {
  title?: string | null;
  subject?: string | null;
  description?: string | null;
}

const DEFAULT_DOMAIN_ORDER: LearningDomain[] = ['numeracy', 'literacy', 'science'];

const DOMAIN_KEYWORDS: Record<LearningDomain, string[]> = {
  numeracy: ['math', 'number', 'count', 'quantity', 'pattern', 'size', 'add', 'subtract'],
  literacy: ['letter', 'phonics', 'read', 'word', 'rhyme', 'story', 'language', 'sound'],
  science: ['science', 'nature', 'animal', 'weather', 'explore', 'experiment'],
  creative_arts: ['art', 'draw', 'paint', 'music', 'creative', 'craft'],
  gross_motor: ['movement', 'move', 'jump', 'dance', 'physical', 'exercise'],
  fine_motor: ['fine motor', 'trace', 'pencil', 'hand', 'finger', 'cut'],
  social_emotional: ['emotion', 'friend', 'social', 'kindness', 'share'],
  cognitive: ['thinking', 'memory', 'logic', 'problem', 'sort', 'match'],
};

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  emoji_farm_count: ['farm', 'animal', 'count', 'number'],
  pattern_train: ['pattern', 'sequence', 'repeat'],
  size_safari: ['size', 'big', 'small', 'compare'],
  letter_friends: ['letter', 'phonics', 'alphabet'],
  rhyme_time: ['rhyme', 'word sound'],
  story_adventure: ['story', 'language', 'creative writing'],
  color_explorer: ['color', 'paint', 'visual'],
  shape_hunters: ['shape', 'geometry'],
  move_and_groove: ['movement', 'gross motor', 'dance'],
  memory_match: ['memory', 'cognitive', 'focus'],
};

const normalizeText = (lesson: PlaygroundLessonContext): string =>
  `${lesson.subject || ''} ${lesson.title || ''} ${lesson.description || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const countMatches = (text: string, keywords: string[]): number =>
  keywords.reduce((score, keyword) => (text.includes(keyword) ? score + 1 : score), 0);

export const getPreferredPlaygroundDomains = (
  lesson: PlaygroundLessonContext,
  limit = 3,
): LearningDomain[] => {
  const haystack = normalizeText(lesson);
  const ranked = (Object.keys(DOMAIN_KEYWORDS) as LearningDomain[])
    .map((domain) => ({
      domain,
      score: countMatches(haystack, DOMAIN_KEYWORDS[domain]),
    }))
    .sort((a, b) => b.score - a.score);

  const matched = ranked.filter((entry) => entry.score > 0).map((entry) => entry.domain);
  if (matched.length === 0) return DEFAULT_DOMAIN_ORDER.slice(0, limit);
  return matched.slice(0, limit);
};

export const getRecommendedPlaygroundActivityIds = (
  lesson: PlaygroundLessonContext,
  activities: PreschoolActivity[] = PRESCHOOL_ACTIVITIES,
): string[] => {
  const text = normalizeText(lesson);
  const preferredDomains = getPreferredPlaygroundDomains(lesson, 4);

  const domainFirst = activities
    .filter((activity) => preferredDomains.includes(activity.domain))
    .map((activity) => activity.id);

  const keywordBoost = Object.entries(ACTIVITY_KEYWORDS)
    .filter(([, keywords]) => countMatches(text, keywords) > 0)
    .map(([activityId]) => activityId);

  return Array.from(new Set([...keywordBoost, ...domainFirst]));
};

export const sortPlaygroundActivitiesForLesson = (
  lesson: PlaygroundLessonContext,
  activities: PreschoolActivity[] = PRESCHOOL_ACTIVITIES,
): PreschoolActivity[] => {
  const recommended = getRecommendedPlaygroundActivityIds(lesson, activities);
  const recommendedRank = new Map(recommended.map((id, index) => [id, index]));

  return [...activities].sort((a, b) => {
    const aRank = recommendedRank.has(a.id) ? recommendedRank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bRank = recommendedRank.has(b.id) ? recommendedRank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.title.localeCompare(b.title);
  });
};

export const isPlaygroundActivityRecommended = (
  lesson: PlaygroundLessonContext,
  activityId: string,
): boolean => getRecommendedPlaygroundActivityIds(lesson).includes(activityId);
