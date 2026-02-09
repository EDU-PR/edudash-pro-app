import {
  getTempLessonSuggestions,
  isTierEligibleForTempLessons,
} from '../parentTempLessonService';
import { ProactiveInsightsService } from '@/services/ProactiveInsightsService';

describe('parentTempLessonService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recognizes eligible tiers', () => {
    expect(isTierEligibleForTempLessons('parent_plus')).toBe(true);
    expect(isTierEligibleForTempLessons('school_premium')).toBe(true);
    expect(isTierEligibleForTempLessons('free')).toBe(false);
  });

  it('builds temporary lesson suggestions from proactive insights lessons', async () => {
    jest
      .spyOn(ProactiveInsightsService.prototype, 'generateProactiveInsights')
      .mockResolvedValue([
        {
          id: 'insight-1',
          type: 'concern',
          priority: 'high',
          title: 'Numeracy support',
          description: 'Needs extra number practice.',
          caps_topics: ['numbers'],
          created_at: new Date().toISOString(),
        } as any,
      ]);

    jest
      .spyOn(ProactiveInsightsService.prototype, 'getInteractiveLessons')
      .mockResolvedValue([
        {
          id: 'lesson-1',
          title: 'Farm counting',
          description: 'Count animals and compare totals',
          grade: 'Grade R',
          subject: 'Mathematics',
          caps_topic: 'Numbers',
          estimated_duration: '20 min',
          duration_minutes: 20,
          difficulty: 'Beginner',
          materials_needed: [],
          instructions: [],
          learning_outcomes: [],
          parent_tips: [],
        } as any,
      ]);

    const suggestions = await getTempLessonSuggestions({
      childId: 'child-1',
      preschoolId: 'school-1',
      limit: 2,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].activityId).toBeTruthy();
    expect(suggestions[0].expiresInDays).toBe(7);
    expect(['easy', 'medium', 'tricky']).toContain(suggestions[0].difficulty);
  });
});
