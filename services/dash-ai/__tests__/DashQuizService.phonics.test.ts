jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
    from: jest.fn(),
  },
}));

import { DashQuizService } from '../DashQuizService';

describe('DashQuizService phonics answer checks', () => {
  it('accepts equivalent blend_word formats', () => {
    expect(DashQuizService.checkAnswer('cat', 'c-a-t', 'blend_word')).toBe(true);
    expect(DashQuizService.checkAnswer('c a t', 'cat', 'blend_word')).toBe(true);
  });

  it('applies tolerant matching for phonics-specific types', () => {
    expect(DashQuizService.checkAnswer('sss', 'sss', 'letter_sound_match')).toBe(true);
    expect(DashQuizService.checkAnswer('hat', 'hat', 'rhyme_match')).toBe(true);
    expect(DashQuizService.checkAnswer('short', 'short', 'vowel_identify')).toBe(true);
  });

  it('keeps non-phonics exact behavior for multiple choice', () => {
    expect(DashQuizService.checkAnswer('B', 'B', 'multiple_choice')).toBe(true);
    expect(DashQuizService.checkAnswer('C', 'B', 'multiple_choice')).toBe(false);
  });
});
