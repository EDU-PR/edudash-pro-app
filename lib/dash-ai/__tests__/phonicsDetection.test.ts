import { detectPhonicsIntent, isPreschoolContext, shouldUsePhonicsMode } from '../phonicsDetection';

describe('phonicsDetection', () => {
  it('detects explicit phonics prompts', () => {
    expect(detectPhonicsIntent('teach me phonics with letter sounds')).toBe(true);
    expect(detectPhonicsIntent('what sound does b make?')).toBe(true);
    expect(detectPhonicsIntent('explain algebra')).toBe(false);
  });

  it('detects preschool context by org type, age, and grade', () => {
    expect(isPreschoolContext({ organizationType: 'preschool' })).toBe(true);
    expect(isPreschoolContext({ ageYears: 5 })).toBe(true);
    expect(isPreschoolContext({ gradeLevel: 'Grade R' })).toBe(true);
    expect(isPreschoolContext({ ageYears: 9, gradeLevel: 'Grade 4' })).toBe(false);
  });

  it('detects spaced letter repetitions and sustained sounds for phonics TTS', () => {
    expect(detectPhonicsIntent('Say s s s slowly')).toBe(true);
    expect(detectPhonicsIntent('The sound sss like a snake')).toBe(true);
    expect(detectPhonicsIntent('m m m for monkey')).toBe(true);
  });

  it('avoids broad false positives for normal speech phrasing', () => {
    expect(detectPhonicsIntent('That sounds like a good plan for class tomorrow')).toBe(false);
    expect(
      shouldUsePhonicsMode('This sounds like a good idea', {
        organizationType: 'preschool',
        ageYears: 5,
      })
    ).toBe(false);
  });

  it('enables phonics mode from explicit content or preschool reading cues', () => {
    expect(shouldUsePhonicsMode('Use /b/ and c-a-t markers')).toBe(true);
    expect(shouldUsePhonicsMode('Say s s s like a snake')).toBe(true);
    expect(
      shouldUsePhonicsMode('let us practice reading letters', {
        organizationType: 'ecd_center',
        ageYears: 6,
      })
    ).toBe(true);
    expect(
      shouldUsePhonicsMode('solve long division', {
        gradeLevel: 'Grade 5',
      })
    ).toBe(false);
  });
});
