/**
 * DashQuizService unit tests
 *
 * Tests the pure-logic portions: answer checking, quiz response parsing,
 * SM-2 spaced repetition, skill level calculation, and string similarity.
 */

import {
  DashQuizService,
  QuizServiceError,
} from '../DashQuizService';
import type { ReviewSchedule } from '@/lib/types/quiz';

// ============================================
// Answer Checking
// ============================================

describe('DashQuizService.checkAnswer', () => {
  it('matches exact multiple_choice answers (case-insensitive)', () => {
    expect(DashQuizService.checkAnswer('B', 'b', 'multiple_choice')).toBe(true);
    expect(DashQuizService.checkAnswer('A', 'b', 'multiple_choice')).toBe(false);
  });

  it('matches true_false answers (case-insensitive)', () => {
    expect(DashQuizService.checkAnswer('True', 'true', 'true_false')).toBe(true);
    expect(DashQuizService.checkAnswer('FALSE', 'false', 'true_false')).toBe(true);
    expect(DashQuizService.checkAnswer('True', 'false', 'true_false')).toBe(false);
  });

  it('matches exact fill_blank answers', () => {
    expect(DashQuizService.checkAnswer('Jupiter', 'Jupiter', 'fill_blank')).toBe(true);
  });

  it('fuzzy-matches fill_blank with minor typos', () => {
    // "Jupter" vs "Jupiter" — 1 char off in 7 chars = ~0.857 similarity > 0.8
    expect(DashQuizService.checkAnswer('Jupter', 'Jupiter', 'fill_blank')).toBe(true);
  });

  it('rejects fill_blank answers with too many errors', () => {
    // "Mars" vs "Jupiter" — completely different
    expect(DashQuizService.checkAnswer('Mars', 'Jupiter', 'fill_blank')).toBe(false);
  });

  it('trims whitespace before comparing', () => {
    expect(DashQuizService.checkAnswer('  B  ', 'B', 'multiple_choice')).toBe(true);
    expect(DashQuizService.checkAnswer(' True ', 'true', 'true_false')).toBe(true);
  });

  it('handles matching type with exact comparison', () => {
    expect(DashQuizService.checkAnswer('1-C,2-A,3-D,4-B', '1-C,2-A,3-D,4-B', 'matching')).toBe(true);
    expect(DashQuizService.checkAnswer('1-C,2-B,3-D,4-A', '1-C,2-A,3-D,4-B', 'matching')).toBe(false);
  });
});

// ============================================
// String Similarity
// ============================================

describe('DashQuizService.stringSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(DashQuizService.stringSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for empty vs non-empty', () => {
    expect(DashQuizService.stringSimilarity('', 'hello')).toBe(0);
    expect(DashQuizService.stringSimilarity('hello', '')).toBe(0);
  });

  it('returns high similarity for single-char difference', () => {
    const sim = DashQuizService.stringSimilarity('kitten', 'sitten');
    expect(sim).toBeGreaterThan(0.8);
  });

  it('returns low similarity for completely different strings', () => {
    const sim = DashQuizService.stringSimilarity('abc', 'xyz');
    expect(sim).toBeLessThan(0.5);
  });
});

// ============================================
// Quiz Response Parsing
// ============================================

describe('DashQuizService.parseQuizResponse', () => {
  it('parses well-formed JSON', () => {
    const json = JSON.stringify({
      questions: [
        {
          question_type: 'multiple_choice',
          question_text: 'What is 2+2?',
          correct_answer: 'B',
          options: [
            { label: 'A', value: '3' },
            { label: 'B', value: '4' },
          ],
          explanation: 'Basic addition',
          hints: ['Count on your fingers'],
          difficulty: 'easy',
        },
      ],
    });

    const result = DashQuizService.parseQuizResponse(json);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question_text).toBe('What is 2+2?');
    expect(result.questions[0].correct_answer).toBe('B');
  });

  it('parses JSON inside markdown code blocks', () => {
    const content = '```json\n{"questions":[{"question_type":"true_false","question_text":"The sky is blue","correct_answer":"True","explanation":"Yes","hints":["Look up"],"difficulty":"easy"}]}\n```';
    const result = DashQuizService.parseQuizResponse(content);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question_type).toBe('true_false');
  });

  it('returns empty array for invalid JSON', () => {
    const result = DashQuizService.parseQuizResponse('not valid json at all');
    expect(result.questions).toEqual([]);
  });

  it('filters out questions missing required fields', () => {
    const json = JSON.stringify({
      questions: [
        { question_type: 'multiple_choice', question_text: 'Valid?', correct_answer: 'Yes' },
        { question_type: 'true_false' }, // missing question_text and correct_answer
        { question_text: 'No type', correct_answer: 'A' }, // missing question_type
      ],
    });

    const result = DashQuizService.parseQuizResponse(json);
    expect(result.questions).toHaveLength(1);
  });

  it('handles non-array questions field', () => {
    const json = JSON.stringify({ questions: 'not an array' });
    const result = DashQuizService.parseQuizResponse(json);
    expect(result.questions).toEqual([]);
  });
});

// ============================================
// Skill Level Calculation
// ============================================

describe('DashQuizService.calculateSkillLevel', () => {
  it('returns beginner for 0', () => {
    expect(DashQuizService.calculateSkillLevel(0)).toBe('beginner');
  });

  it('returns developing for 20-49', () => {
    expect(DashQuizService.calculateSkillLevel(20)).toBe('developing');
    expect(DashQuizService.calculateSkillLevel(49)).toBe('developing');
  });

  it('returns proficient for 50-74', () => {
    expect(DashQuizService.calculateSkillLevel(50)).toBe('proficient');
    expect(DashQuizService.calculateSkillLevel(74)).toBe('proficient');
  });

  it('returns advanced for 75-89', () => {
    expect(DashQuizService.calculateSkillLevel(75)).toBe('advanced');
    expect(DashQuizService.calculateSkillLevel(89)).toBe('advanced');
  });

  it('returns mastery for 90+', () => {
    expect(DashQuizService.calculateSkillLevel(90)).toBe('mastery');
    expect(DashQuizService.calculateSkillLevel(100)).toBe('mastery');
  });
});

// ============================================
// SM-2 Spaced Repetition
// ============================================

describe('DashQuizService.sm2Update', () => {
  const baseSchedule: ReviewSchedule = {
    id: 'test-id',
    user_id: 'user-1',
    question_id: 'q-1',
    ease_factor: 2.5,
    repetitions: 0,
    interval_days: 1,
    next_review_date: '2026-02-10',
    last_reviewed_at: null,
    quality_history: [],
  };

  it('resets repetitions on low quality (< 3)', () => {
    const result = DashQuizService.sm2Update(baseSchedule, 1);
    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
  });

  it('increments repetitions on quality >= 3', () => {
    const result = DashQuizService.sm2Update(baseSchedule, 4);
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1); // first rep = 1 day
  });

  it('sets interval to 6 on second repetition', () => {
    const afterFirst: ReviewSchedule = { ...baseSchedule, repetitions: 1, interval_days: 1 };
    const result = DashQuizService.sm2Update(afterFirst, 4);
    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(6);
  });

  it('multiplies interval by ease factor on subsequent reps', () => {
    const afterSecond: ReviewSchedule = { ...baseSchedule, repetitions: 2, interval_days: 6, ease_factor: 2.5 };
    const result = DashQuizService.sm2Update(afterSecond, 4);
    expect(result.repetitions).toBe(3);
    expect(result.intervalDays).toBe(15); // round(6 * 2.5) = 15
  });

  it('adjusts ease factor based on quality', () => {
    // Quality 5 (perfect) should increase ease factor
    const perfect = DashQuizService.sm2Update(baseSchedule, 5);
    expect(perfect.easeFactor).toBeGreaterThan(2.5);

    // Quality 3 (barely) should decrease ease factor
    const barely = DashQuizService.sm2Update(baseSchedule, 3);
    expect(barely.easeFactor).toBeLessThan(2.5);
  });

  it('never drops ease factor below 1.3', () => {
    const lowEase: ReviewSchedule = { ...baseSchedule, ease_factor: 1.3 };
    const result = DashQuizService.sm2Update(lowEase, 0);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('returns a valid date string for nextReviewDate', () => {
    const result = DashQuizService.sm2Update(baseSchedule, 4);
    expect(result.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================
// Error class
// ============================================

describe('QuizServiceError', () => {
  it('has name, code, and message', () => {
    const err = new QuizServiceError('Test error', 'test_code');
    expect(err.name).toBe('QuizServiceError');
    expect(err.code).toBe('test_code');
    expect(err.message).toBe('Test error');
  });

  it('preserves cause', () => {
    const cause = new Error('inner');
    const err = new QuizServiceError('outer', 'code', cause);
    expect(err.cause).toBe(cause);
  });
});
