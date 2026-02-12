import { classifyPhonemeMastery } from '../phonicsProgress';

describe('phonicsProgress', () => {
  it('maps mastery thresholds correctly', () => {
    expect(classifyPhonemeMastery(92)).toBe('green');
    expect(classifyPhonemeMastery(81)).toBe('green');
    expect(classifyPhonemeMastery(80)).toBe('amber');
    expect(classifyPhonemeMastery(65)).toBe('amber');
    expect(classifyPhonemeMastery(50)).toBe('amber');
    expect(classifyPhonemeMastery(49)).toBe('red');
    expect(classifyPhonemeMastery(12)).toBe('red');
    expect(classifyPhonemeMastery(null)).toBe('amber');
  });
});
