import { resolveDashRouteIntent } from '@/features/dash-assistant/types';

describe('resolveDashRouteIntent', () => {
  it('routes lesson generation prompts to lesson_generation', () => {
    const decision = resolveDashRouteIntent({
      text: 'Generate a lesson for 4-6 year olds about animals',
      handoffSource: 'teacher_dashboard',
      externalTutorMode: 'diagnostic',
    });

    expect(decision.intent).toBe('lesson_generation');
    expect(decision.reason).toBe('lesson_keywords');
  });

  it('routes weekly theme prompts to weekly_theme_plan', () => {
    const decision = resolveDashRouteIntent({
      text: 'Create a weekly theme plan for Grade R',
    });

    expect(decision.intent).toBe('weekly_theme_plan');
    expect(decision.reason).toBe('weekly_theme_keywords');
  });

  it('routes daily routine prompts to daily_routine_plan', () => {
    const decision = resolveDashRouteIntent({
      text: 'Please build a daily routine program for our preschool',
    });

    expect(decision.intent).toBe('daily_routine_plan');
    expect(decision.reason).toBe('daily_routine_keywords');
  });

  it('uses tutor route for explicit tutor mode when no planner intent exists', () => {
    const decision = resolveDashRouteIntent({
      text: 'Help me with fractions',
      externalTutorMode: 'diagnostic',
    });

    expect(decision.intent).toBe('tutor');
    expect(decision.reason).toBe('explicit_tutor_mode');
  });

  it('falls back to tutor for teacher_dashboard default without planner keywords', () => {
    const decision = resolveDashRouteIntent({
      text: 'Can you help?',
      handoffSource: 'teacher_dashboard',
    });

    expect(decision.intent).toBe('tutor');
    expect(decision.reason).toBe('teacher_dashboard_default');
  });
});
