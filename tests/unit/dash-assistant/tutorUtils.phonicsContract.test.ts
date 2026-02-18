import { buildTutorSystemContext } from '@/hooks/dash-assistant/tutorUtils';
import type { TutorSession } from '@/hooks/dash-assistant/tutorTypes';

describe('tutorUtils phonics contract', () => {
  const baseSession: TutorSession = {
    id: 'session-1',
    mode: 'practice',
    awaitingAnswer: false,
    questionIndex: 0,
    totalQuestions: 0,
    correctCount: 0,
    maxQuestions: 3,
    difficulty: 1,
    incorrectStreak: 0,
    correctStreak: 0,
    attemptsOnQuestion: 0,
    phonicsMode: true,
    phonicsStage: 'cvc_blending',
  };

  it('uses sound-first blending wording in phonics mode', () => {
    const prompt = buildTutorSystemContext(baseSession, { phase: 'start' });
    expect(prompt).toContain('/k/ - /a/ - /t/ ... cat');
  });

  it('does not include legacy orthography-first blend phrase', () => {
    const prompt = buildTutorSystemContext(baseSession, { phase: 'start' });
    expect(prompt).not.toContain('c-a-t becomes cat');
  });
});
