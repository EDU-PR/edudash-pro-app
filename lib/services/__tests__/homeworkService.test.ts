/**
 * Tests for lib/services/homeworkService.ts — gradeHomework and streamGradeHomework
 *
 * AI_ENABLED is a module-level const evaluated at require time:
 *   const AI_ENABLED = isAIEnabled()
 * So we must use jest.isolateModules + jest.doMock to get a fresh module
 * with the correct AI_ENABLED value per test.
 */

// Shared mocks — these are re-used across isolated modules
const mockInvoke = jest.fn();
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn() });
const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
const mockSupabase = {
  functions: { invoke: mockInvoke },
  from: mockFrom,
};

/** Helper: require a fresh HomeworkService with given AI_ENABLED value */
function getFreshService(aiEnabled: boolean): typeof import('../homeworkService') {
  let mod: typeof import('../homeworkService');
  jest.isolateModules(() => {
    jest.doMock('@/lib/ai/aiConfig', () => ({
      isAIEnabled: () => aiEnabled,
      getAIModel: () => 'claude-sonnet-4-20250514',
      getAILocale: () => 'en-ZA',
    }));
    jest.doMock('@/lib/supabase', () => ({
      assertSupabase: () => mockSupabase,
    }));
    jest.doMock('@/lib/analytics', () => ({
      track: jest.fn(),
    }));
    jest.doMock('@/lib/i18n', () => ({
      getCurrentLanguage: () => 'en',
    }));
    mod = require('../homeworkService');
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HomeworkService.gradeHomework', () => {
  it('returns requiresManualReview=true when AI is disabled', async () => {
    const { HomeworkService } = getFreshService(false);

    const result = await HomeworkService.gradeHomework('sub-1', 'My answer', 'Math Test', 'Grade 1');
    expect(result.score).toBeNull();
    expect(result.requiresManualReview).toBe(true);
    expect(result.feedback).toContain('manually');
  });

  it('returns AI score when AI succeeds', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        result: {
          score: 92,
          feedback: 'Excellent work!',
          strengths: ['Clear reasoning'],
          areasForImprovement: ['Show more steps'],
          suggestions: ['Try harder problems'],
        },
      },
      error: null,
    });

    const { HomeworkService } = getFreshService(true);

    const result = await HomeworkService.gradeHomework('sub-2', 'Good answer', 'Science Quiz', 'Grade 3');
    expect(result.score).toBe(92);
    expect(result.feedback).toBe('Excellent work!');
    expect(result.requiresManualReview).toBe(false);
  });

  it('returns requiresManualReview=true on API error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Service unavailable'));

    const { HomeworkService } = getFreshService(true);

    const result = await HomeworkService.gradeHomework('sub-3', 'Answer', 'Test', 'Grade 2');
    expect(result.score).toBeNull();
    expect(result.requiresManualReview).toBe(true);
    expect(result.feedback).toContain('error');
  });
});

describe('HomeworkService.streamGradeHomework', () => {
  it('calls onError when AI is disabled', async () => {
    const handlers = {
      onDelta: jest.fn(),
      onFinal: jest.fn(),
      onError: jest.fn(),
    };

    const { HomeworkService } = getFreshService(false);

    await HomeworkService.streamGradeHomework('sub-4', 'Content', 'Title', 'Grade 1', handlers);
    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ai_disabled' })
    );
    expect(handlers.onFinal).not.toHaveBeenCalled();
  });
});
