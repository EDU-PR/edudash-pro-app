import { buildTutorDisplayContent } from '@/hooks/dash-assistant/tutorUtils';

describe('tutorUtils display formatting', () => {
  it('dedupes repeated hint/steps blocks in tutor evaluation output', () => {
    const content = buildTutorDisplayContent(
      {
        is_correct: false,
        feedback: [
          "Let's think about this.",
          'Hint: the key numbers are 400.',
          'Steps:\n1. Identify what the question is asking.\n2. Choose the correct operation.\n3. Calculate carefully.\n4. Check your result.',
        ].join('\n\n'),
        hint: 'Hint: the key numbers are 400.',
        steps:
          'Steps:\n1. Identify what the question is asking.\n2. Choose the correct operation.\n3. Calculate carefully.\n4. Check your result.',
        follow_up_question: 'Step 1: Which operation should we use with 400?',
      },
      false
    );

    expect(content).toBeTruthy();
    const output = String(content || '');
    expect((output.match(/Hint: the key numbers are 400\./g) || []).length).toBe(1);
    expect((output.match(/Steps:/g) || []).length).toBe(1);
  });
});

