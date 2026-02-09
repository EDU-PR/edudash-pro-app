import { PRESCHOOL_ACTIVITIES, getActivityById } from '@/lib/activities/preschoolActivities.data';
import { buildPlaygroundVariant } from '@/lib/activities/playgroundDifficulty';
import { sortPlaygroundActivitiesForLesson } from '@/lib/activities/playgroundLessonAlignment';
import type { PlaygroundDifficultyLevel } from '@/lib/activities/playgroundDifficulty';
import type { ActivityGameType } from '@/lib/activities/preschoolActivities.types';
import { assertSupabase } from '@/lib/supabase';
import {
  ProactiveInsightsService,
  type ProactiveInsight,
} from '@/services/ProactiveInsightsService';

const TEMP_LESSON_ELIGIBLE_TIERS = new Set([
  'parent_plus',
  'premium',
  'pro',
  'enterprise',
  'school_premium',
  'school_pro',
  'school_enterprise',
]);

export interface TempLessonSuggestion {
  id: string;
  activityId: string;
  title: string;
  domain: string;
  reason: string;
  difficulty: PlaygroundDifficultyLevel;
  estimatedDurationMinutes: number;
  expiresInDays: number;
}

export interface GetTempLessonSuggestionsParams {
  childId: string;
  preschoolId: string;
  limit?: number;
}

export interface CreateTempLessonFromSuggestionParams {
  childId: string;
  suggestion: TempLessonSuggestion;
  difficulty?: PlaygroundDifficultyLevel;
}

const toInteractiveActivityType = (gameType: ActivityGameType): string => {
  switch (gameType) {
    case 'emoji_counting':
      return 'counting';
    case 'memory_flip':
      return 'memory';
    case 'sorting_fun':
      return 'sorting';
    case 'letter_trace':
      return 'tracing';
    case 'color_match':
    case 'sound_match':
      return 'matching';
    default:
      return 'quiz';
  }
};

const normalizeTier = (tier?: string | null): string => String(tier || 'free').toLowerCase();

const pickSuggestionReason = (
  lessonTitle: string,
  lessonSubject: string,
  insights: ProactiveInsight[],
): string => {
  const loweredTitle = lessonTitle.toLowerCase();
  const loweredSubject = lessonSubject.toLowerCase();

  const matchedInsight = insights.find((insight) => {
    const topicMatches = (insight.caps_topics || []).some((topic) => {
      const normalizedTopic = topic.toLowerCase();
      return loweredTitle.includes(normalizedTopic) || normalizedTopic.includes(loweredSubject);
    });
    if (topicMatches) return true;
    return insight.description.toLowerCase().includes(loweredSubject);
  });

  if (matchedInsight?.description) return matchedInsight.description;
  return `Suggested by Dash to support ${lessonSubject} practice at home.`;
};

const pickSuggestionDifficulty = (insights: ProactiveInsight[]): PlaygroundDifficultyLevel => {
  const highConcern = insights.some((insight) => insight.priority === 'high' && insight.type === 'concern');
  if (highConcern) return 'easy';
  return 'medium';
};

export function isTierEligibleForTempLessons(tier?: string | null): boolean {
  return TEMP_LESSON_ELIGIBLE_TIERS.has(normalizeTier(tier));
}

export async function getTempLessonSuggestions(
  params: GetTempLessonSuggestionsParams,
): Promise<TempLessonSuggestion[]> {
  const { childId, preschoolId, limit = 3 } = params;
  const service = new ProactiveInsightsService(preschoolId);
  const [insights, lessons] = await Promise.all([
    service.generateProactiveInsights(childId),
    service.getInteractiveLessons(childId, Math.max(limit * 2, 6)),
  ]);

  const suggestions: TempLessonSuggestion[] = [];
  const usedActivities = new Set<string>();
  const difficulty = pickSuggestionDifficulty(insights);

  for (const lesson of lessons) {
    const sortedActivities = sortPlaygroundActivitiesForLesson(
      {
        title: lesson.title,
        subject: lesson.subject,
        description: lesson.description,
      },
      PRESCHOOL_ACTIVITIES,
    );

    const selected = sortedActivities.find((activity) => !usedActivities.has(activity.id));
    if (!selected) continue;

    usedActivities.add(selected.id);
    suggestions.push({
      id: `${childId}:${selected.id}`,
      activityId: selected.id,
      title: selected.title,
      domain: selected.domain,
      reason: pickSuggestionReason(lesson.title, lesson.subject, insights),
      difficulty,
      estimatedDurationMinutes: selected.durationMinutes,
      expiresInDays: 7,
    });

    if (suggestions.length >= limit) break;
  }

  if (suggestions.length > 0) return suggestions;

  return PRESCHOOL_ACTIVITIES.slice(0, limit).map((activity) => ({
    id: `${childId}:${activity.id}`,
    activityId: activity.id,
    title: activity.title,
    domain: activity.domain,
    reason: `Suggested by Dash to reinforce ${activity.domain.replace('_', ' ')} skills.`,
    difficulty: 'medium',
    estimatedDurationMinutes: activity.durationMinutes,
    expiresInDays: 7,
  }));
}

export async function createTempLessonFromSuggestion(
  params: CreateTempLessonFromSuggestionParams,
): Promise<string> {
  const { childId, suggestion } = params;
  const difficulty = params.difficulty || suggestion.difficulty || 'medium';
  const baseActivity = getActivityById(suggestion.activityId);

  if (!baseActivity) {
    throw new Error(`Unknown activity: ${suggestion.activityId}`);
  }

  const snapshot = buildPlaygroundVariant(baseActivity, difficulty);
  const { data, error } = await assertSupabase().rpc('create_parent_temp_lesson', {
    p_child_id: childId,
    p_domain: suggestion.domain,
    p_activity_id: suggestion.activityId,
    p_difficulty: difficulty,
    p_reason: suggestion.reason,
    p_snapshot: snapshot as any,
    p_title: `Temporary Lesson • ${snapshot.title}`,
    p_activity_type: toInteractiveActivityType(snapshot.gameType),
    p_duration_minutes: snapshot.durationMinutes,
  });

  if (error) throw error;
  if (!data) throw new Error('Temporary lesson assignment was not created');
  return String(data);
}
