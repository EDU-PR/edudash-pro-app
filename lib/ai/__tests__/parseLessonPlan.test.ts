jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}), { virtual: true });

import { parseLessonPlanResponse } from '../parseLessonPlan';

const validJsonPayload = JSON.stringify({
  lessonPlan: {
    title: 'Fractions Foundations',
    summary: 'Introduce simple fractions with concrete examples.',
    objectives: ['Identify halves and quarters', 'Explain fraction meaning'],
    materials: ['Paper strips', 'Whiteboard'],
    steps: [
      {
        title: 'Warm-up',
        minutes: 10,
        objective: 'Activate prior knowledge.',
        instructions: ['Ask learners where they have seen fractions.'],
        teacherPrompt: 'Where do we see halves in everyday life?',
        example: 'Cut an apple into two equal parts.',
      },
    ],
    assessment: ['Exit ticket: draw one half and one quarter.'],
    differentiation: {
      support: 'Use concrete manipulatives and sentence starters.',
      extension: 'Compare eighths and quarters.',
    },
    closure: 'Recap key vocabulary and preview next lesson.',
    durationMinutes: 45,
  },
});

describe('parseLessonPlanResponse', () => {
  it('parses valid JSON payload', () => {
    const plan = parseLessonPlanResponse(validJsonPayload);
    expect(plan.title).toBe('Fractions Foundations');
    expect(plan.sourceFormat).toBe('json');
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('parses fenced JSON payload', () => {
    const fenced = `\`\`\`json\n${validJsonPayload}\n\`\`\``;
    const plan = parseLessonPlanResponse(fenced);
    expect(plan.sourceFormat).toBe('json');
    expect(plan.durationMinutes).toBe(45);
  });

  it('falls back to markdown normalization when JSON is missing', () => {
    const markdown = `
# Addition Lesson

## Objectives
- Add single-digit numbers
- Explain each step

## Materials
- Counters
- Whiteboard

## Activity 1 (10 min)
- Learners solve 5 examples in pairs
- Teacher prompt: How did you get your answer?
- Example: 3 + 2 = 5

## Assessment
- Quick oral quiz

## Closure
Reflect on the strategy used.
`;
    const plan = parseLessonPlanResponse(markdown);
    expect(plan.sourceFormat).toBe('markdown_fallback');
    expect(plan.objectives.length).toBeGreaterThan(0);
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('returns resilient fallback for malformed payload', () => {
    const malformed = 'not-json and no headings just plain response text';
    const plan = parseLessonPlanResponse(malformed);
    expect(plan.title).toBeTruthy();
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});

