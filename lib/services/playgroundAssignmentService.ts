import { assertSupabase } from '@/lib/supabase';
import { getActivityById } from '@/lib/activities/preschoolActivities.data';
import {
  buildPlaygroundVariant,
  mapPlaygroundDifficultyToLevel,
} from '@/lib/activities/playgroundDifficulty';
import type {
  ActivityGameType,
  ActivityResult,
  PreschoolActivity,
} from '@/lib/activities/preschoolActivities.types';
import type { PlaygroundDifficultyLevel } from '@/lib/activities/playgroundDifficulty';

export interface PlaygroundLessonReference {
  id: string;
  title: string;
  subject?: string | null;
  description?: string | null;
}

export interface EnsurePlaygroundInteractiveActivityParams {
  preschoolId: string;
  teacherId: string;
  /** When null, creates standalone playground assignment (no lesson). */
  lesson: PlaygroundLessonReference | null;
  presetActivityId: string;
  difficulty: PlaygroundDifficultyLevel;
}

export interface PlaygroundSnapshotContent {
  source: 'dash_playground' | 'dash_temp_lesson';
  preset_activity_id: string;
  difficulty: PlaygroundDifficultyLevel;
  domain: string;
  snapshot: PreschoolActivity;
  linked_lesson_id?: string;
  linked_lesson_title?: string;
  suggestion_reason?: string;
  expires_at?: string;
}

export interface PlaygroundInteractiveActivityRecord {
  id: string;
  title: string;
  activity_type: string;
  description: string | null;
  content: PlaygroundSnapshotContent;
}

export interface CompleteAssignedPlaygroundActivityParams {
  assignmentId: string;
  result: ActivityResult;
  difficulty: PlaygroundDifficultyLevel;
  activityMeta?: Record<string, unknown>;
  assignedContext?: 'school' | 'aftercare' | 'home';
}

const toSubject = (domain: string): string => {
  switch (domain) {
    case 'numeracy':
      return 'mathematics';
    case 'literacy':
      return 'language';
    case 'science':
      return 'science';
    case 'gross_motor':
      return 'physical_education';
    case 'fine_motor':
      return 'life_skills';
    case 'social_emotional':
      return 'life_orientation';
    case 'creative_arts':
      return 'creative_arts';
    default:
      return 'life_skills';
  }
};

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

const parseAgeRange = (ageRange: string): { min: number; max: number } => {
  const [minRaw, maxRaw] = ageRange.split('-');
  const min = Number.parseInt(minRaw || '3', 10);
  const max = Number.parseInt(maxRaw || '5', 10);
  return {
    min: Number.isFinite(min) ? min : 3,
    max: Number.isFinite(max) ? max : 5,
  };
};

const parseSnapshotContent = (value: unknown): PlaygroundSnapshotContent | null => {
  if (!value) return null;
  const content = typeof value === 'string' ? safeParseJson(value) : value;
  if (!content || typeof content !== 'object') return null;
  const record = content as Record<string, unknown>;
  if (record.source !== 'dash_playground' && record.source !== 'dash_temp_lesson') return null;
  if (!record.preset_activity_id || !record.snapshot) return null;
  return record as unknown as PlaygroundSnapshotContent;
};

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeRecord = (row: any): PlaygroundInteractiveActivityRecord => {
  const parsedContent = parseSnapshotContent(row.content);
  if (!parsedContent) {
    throw new Error('Invalid playground snapshot content in interactive_activities row');
  }

  return {
    id: row.id,
    title: row.title,
    activity_type: row.activity_type,
    description: row.description || null,
    content: parsedContent,
  };
};

export async function ensurePlaygroundInteractiveActivity(
  params: EnsurePlaygroundInteractiveActivityParams,
): Promise<PlaygroundInteractiveActivityRecord> {
  const { preschoolId, teacherId, lesson, presetActivityId, difficulty } = params;
  const baseActivity = getActivityById(presetActivityId);
  if (!baseActivity) {
    throw new Error(`Unknown playground activity: ${presetActivityId}`);
  }

  const snapshot = buildPlaygroundVariant(baseActivity, difficulty);
  const linkedLessonId = lesson?.id ?? null;
  const linkedLessonTitle = lesson?.title ?? 'Playground practice';
  const content: PlaygroundSnapshotContent & { linked_lesson_id?: string | null } = {
    source: 'dash_playground',
    preset_activity_id: presetActivityId,
    difficulty,
    domain: snapshot.domain,
    snapshot,
    linked_lesson_title: linkedLessonTitle,
  };
  if (linkedLessonId) {
    content.linked_lesson_id = linkedLessonId;
  } else {
    content.linked_lesson_id = null;
  }

  const supabase = assertSupabase();
  const dedupFilter: Record<string, unknown> = {
    source: 'dash_playground',
    preset_activity_id: presetActivityId,
    difficulty,
    linked_lesson_id: linkedLessonId ?? null,
  };
  const { data: existing, error: existingError } = await supabase
    .from('interactive_activities')
    .select('id, title, activity_type, description, content')
    .eq('preschool_id', preschoolId)
    .contains('content', dedupFilter)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return normalizeRecord(existing);
  }

  const age = parseAgeRange(snapshot.ageRange);
  const { data: inserted, error: insertError } = await supabase
    .from('interactive_activities')
    .insert({
      preschool_id: preschoolId,
      teacher_id: teacherId,
      created_by: teacherId,
      activity_type: toInteractiveActivityType(snapshot.gameType),
      title: lesson ? `${lesson.title} • ${snapshot.title} (${difficulty})` : `${snapshot.title} (${difficulty})`,
      description: snapshot.subtitle || snapshot.learningObjective || null,
      instructions: snapshot.learningObjective || snapshot.subtitle || null,
      content,
      difficulty_level: mapPlaygroundDifficultyToLevel(difficulty),
      age_group_min: age.min,
      age_group_max: age.max,
      stars_reward: 3,
      subject: toSubject(snapshot.domain),
      stem_category: 'none',
      is_active: true,
      is_published: true,
      is_template: false,
    })
    .select('id, title, activity_type, description, content')
    .single();

  if (insertError || !inserted) {
    throw insertError || new Error('Failed to create playground activity snapshot');
  }

  return normalizeRecord(inserted);
}

export async function completeAssignedPlaygroundActivity(
  params: CompleteAssignedPlaygroundActivityParams,
): Promise<any> {
  const { assignmentId, result, difficulty, activityMeta = {}, assignedContext = 'home' } = params;
  const score = result.totalRounds > 0
    ? Math.round((result.correctAnswers / result.totalRounds) * 100)
    : 0;

  const payload = {
    stars: result.stars,
    correct_answers: result.correctAnswers,
    total_rounds: result.totalRounds,
    used_hints: result.usedHints,
    completed_at: result.completedAt,
    source: 'dash_playground',
    assigned_context: assignedContext,
  };

  const client = assertSupabase() as any;
  const { data, error } = await client.rpc('complete_playground_assignment', {
    p_assignment_id: assignmentId,
    p_score: score,
    p_time_spent_seconds: result.timeSpentSeconds,
    p_feedback: payload,
    p_completed_at: result.completedAt,
    p_difficulty: difficulty,
    p_activity_meta: activityMeta,
  });

  if (error) throw error;
  return data;
}

export function getSnapshotFromInteractiveContent(content: unknown): PlaygroundSnapshotContent | null {
  return parseSnapshotContent(content);
}
