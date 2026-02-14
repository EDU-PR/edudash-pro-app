import {
  classifyFullChatIntent,
  FULL_CHAT_CHART_INTENT_REGEX,
  FULL_CHAT_QUIZ_INTENT_REGEX,
} from '@/lib/dash-ai/fullChatIntent';

describe('fullChatIntent', () => {
  it('classifies quiz intents', () => {
    expect(FULL_CHAT_QUIZ_INTENT_REGEX.test('Can you quiz me on fractions?')).toBe(true);
    expect(classifyFullChatIntent('Please test me with multiple choice')).toBe('quiz');
  });

  it('classifies chart intents', () => {
    expect(FULL_CHAT_CHART_INTENT_REGEX.test('Show me a bar chart for term marks')).toBe(true);
    expect(classifyFullChatIntent('Visualize this data in a pie chart')).toBe('chart');
  });

  it('ignores non-quiz and non-chart prompts', () => {
    expect(classifyFullChatIntent('Explain photosynthesis in simple steps')).toBeNull();
  });
});
