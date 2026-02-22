export type DashRouteIntent =
  | 'tutor'
  | 'lesson_generation'
  | 'weekly_theme_plan'
  | 'daily_routine_plan';

export interface DashRouteDecision {
  intent: DashRouteIntent;
  reason:
    | 'weekly_theme_keywords'
    | 'daily_routine_keywords'
    | 'lesson_keywords'
    | 'explicit_tutor_mode'
    | 'tutor_keywords'
    | 'teacher_dashboard_default'
    | 'default_tutor';
}

const WEEKLY_THEME_PLAN_PATTERN =
  /\b(weekly\s+(theme|plan)|theme\s+for\s+the\s+week|week(?:ly)?\s+theme|theme\s+plan)\b/i;
const DAILY_ROUTINE_PLAN_PATTERN =
  /\b(daily\s+(routine|program|programme|schedule|timetable)|routine\s+for\s+(the\s+)?day|day\s+(program|programme|schedule))\b/i;
const LESSON_GENERATION_PATTERN =
  /\b((create|plan|generate)\s+(a\s+)?lesson(\s+plan)?|lesson\s+plan|teaching\s+activity|activities\s+for\s+\d|lesson\s+for\s+\d)\b/i;
const TUTOR_KEYWORDS_PATTERN =
  /\b(tutor|diagnostic|quiz|practice|test\s+me|ask\s+me\s+questions|check\s+my\s+answer|help\s+me\s+solve)\b/i;

export function resolveDashRouteIntent(input: {
  text: string;
  handoffSource?: string | null;
  externalTutorMode?: string | null;
}): DashRouteDecision {
  const text = String(input.text || '');
  const handoffSource = String(input.handoffSource || '').toLowerCase();
  const externalTutorMode = String(input.externalTutorMode || '').trim();

  if (WEEKLY_THEME_PLAN_PATTERN.test(text)) {
    return { intent: 'weekly_theme_plan', reason: 'weekly_theme_keywords' };
  }
  if (DAILY_ROUTINE_PLAN_PATTERN.test(text)) {
    return { intent: 'daily_routine_plan', reason: 'daily_routine_keywords' };
  }
  if (LESSON_GENERATION_PATTERN.test(text)) {
    return { intent: 'lesson_generation', reason: 'lesson_keywords' };
  }
  if (externalTutorMode) {
    return { intent: 'tutor', reason: 'explicit_tutor_mode' };
  }
  if (TUTOR_KEYWORDS_PATTERN.test(text)) {
    return { intent: 'tutor', reason: 'tutor_keywords' };
  }
  if (handoffSource === 'teacher_dashboard') {
    return { intent: 'tutor', reason: 'teacher_dashboard_default' };
  }
  return { intent: 'tutor', reason: 'default_tutor' };
}
