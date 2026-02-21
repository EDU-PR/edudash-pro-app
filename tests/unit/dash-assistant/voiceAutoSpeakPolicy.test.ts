import {
  containsSpellingBlock,
  isLearnerRole,
  resolveAutoSpeakPreference,
  shouldAutoSpeak,
} from '@/features/dash-assistant/voiceAutoSpeakPolicy';

describe('voiceAutoSpeakPolicy', () => {
  it('detects learner roles', () => {
    expect(isLearnerRole('student')).toBe(true);
    expect(isLearnerRole('learner')).toBe(true);
    expect(isLearnerRole('teacher')).toBe(false);
  });

  it('detects spelling blocks in assistant text', () => {
    const text = 'Try this:\n```spelling\n{"type":"spelling_practice","word":"orange"}\n```';
    expect(containsSpellingBlock(text)).toBe(true);
    expect(containsSpellingBlock('No special block here')).toBe(false);
  });

  it('defaults learner auto-speak to false when no explicit preference exists', () => {
    expect(
      resolveAutoSpeakPreference({
        role: 'student',
        explicitAutoSpeak: null,
        hasExplicitPreference: false,
      })
    ).toBe(false);
    expect(
      resolveAutoSpeakPreference({
        role: 'teacher',
        explicitAutoSpeak: null,
        hasExplicitPreference: false,
      })
    ).toBe(true);
  });

  it('respects explicit stored preference', () => {
    expect(
      resolveAutoSpeakPreference({
        role: 'student',
        explicitAutoSpeak: true,
        hasExplicitPreference: true,
      })
    ).toBe(true);
    expect(
      resolveAutoSpeakPreference({
        role: 'teacher',
        explicitAutoSpeak: false,
        hasExplicitPreference: true,
      })
    ).toBe(false);
  });

  it('blocks auto-speak for spelling content even when enabled', () => {
    expect(
      shouldAutoSpeak({
        role: 'teacher',
        voiceEnabled: true,
        autoSpeakEnabled: true,
        responseText: '```spelling\n{"type":"spelling_practice","word":"orange"}\n```',
      })
    ).toBe(false);
  });

  it('allows auto-speak only when enabled and content is non-spelling', () => {
    expect(
      shouldAutoSpeak({
        role: 'teacher',
        voiceEnabled: true,
        autoSpeakEnabled: true,
        responseText: 'Great work, let us continue.',
      })
    ).toBe(true);
    expect(
      shouldAutoSpeak({
        role: 'teacher',
        voiceEnabled: false,
        autoSpeakEnabled: true,
        responseText: 'Great work, let us continue.',
      })
    ).toBe(false);
  });
});

