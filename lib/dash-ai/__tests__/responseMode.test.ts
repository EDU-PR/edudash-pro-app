import {
  classifyResponseMode,
  isDirectWritingRequest,
  isExplicitTutorInteractiveIntent,
  isTutorExitIntent,
} from '@/lib/dash-ai/responseMode';

describe('responseMode', () => {
  it('classifies attachment-based writing prompts as direct_writing', () => {
    expect(
      classifyResponseMode({
        text: 'Help me write an essay based on this image',
        hasAttachments: true,
      })
    ).toBe('direct_writing');
  });

  it('classifies quiz-style prompts as tutor_interactive', () => {
    expect(
      classifyResponseMode({
        text: 'Quiz me on fractions',
      })
    ).toBe('tutor_interactive');
  });

  it('defaults to explain_direct for normal help prompts', () => {
    expect(
      classifyResponseMode({
        text: 'Please explain this maths question',
      })
    ).toBe('explain_direct');
  });

  it('keeps tutor mode for active tutor sessions on normal replies', () => {
    expect(
      classifyResponseMode({
        text: 'I think the answer is 12',
        hasActiveTutorSession: true,
      })
    ).toBe('tutor_interactive');
  });

  it('forces tutor mode when explicit tutor mode is set', () => {
    expect(
      classifyResponseMode({
        text: 'hello there',
        explicitTutorMode: true,
      })
    ).toBe('tutor_interactive');
  });

  it('still allows explicit exit intent while explicit tutor mode is set', () => {
    expect(
      classifyResponseMode({
        text: 'stop tutor for now',
        explicitTutorMode: true,
      })
    ).toBe('explain_direct');
  });

  it('lets direct writing requests exit an active tutor session', () => {
    expect(
      classifyResponseMode({
        text: 'Can you rewrite this paragraph?',
        hasAttachments: true,
        hasActiveTutorSession: true,
      })
    ).toBe('direct_writing');
  });

  it('detects direct writing requests', () => {
    expect(isDirectWritingRequest('Draft a speech for grade 5', false)).toBe(true);
  });

  it('detects explicit tutor intents', () => {
    expect(isExplicitTutorInteractiveIntent('test me with one question at a time')).toBe(true);
  });

  it('detects tutor exit intents', () => {
    expect(isTutorExitIntent('stop tutor and switch to a different task')).toBe(true);
  });
});
