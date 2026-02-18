import {
  buildLanguageDirectiveForTurn,
  detectLanguageFromText,
  detectLanguageOverrideFromText,
  normalizeDashLocale,
  resolveResponseLocale,
} from '@/lib/dash-ai/languageRouting';

describe('languageRouting', () => {
  it('normalizes locale values', () => {
    expect(normalizeDashLocale('af')).toBe('af-ZA');
    expect(normalizeDashLocale('zu-ZA')).toBe('zu-ZA');
    expect(normalizeDashLocale('fr-FR')).toBeNull();
  });

  it('detects explicit language overrides from text', () => {
    expect(detectLanguageOverrideFromText('antwoord in afrikaans asseblief')).toBe('af-ZA');
    expect(detectLanguageOverrideFromText('please answer in English')).toBe('en-ZA');
  });

  it('detects likely language from response text', () => {
    expect(detectLanguageFromText('Dankie asseblief verduidelik hierdie som')).toBe('af-ZA');
    expect(detectLanguageFromText('Sawubona ngiyacela ngiyabonga mfundi')).toBe('zu-ZA');
  });

  it('resolves explicit override before auto detect or preference', () => {
    expect(
      resolveResponseLocale({
        explicitOverride: 'zu',
        responseText: 'Dankie baie',
        fallbackPreference: 'en-ZA',
      })
    ).toEqual({ locale: 'zu-ZA', source: 'explicit_override' });
  });

  it('falls back to preference when no explicit or auto-detect signal exists', () => {
    expect(
      resolveResponseLocale({
        responseText: 'Solve the equation and show the steps',
        fallbackPreference: 'af-ZA',
      })
    ).toEqual({ locale: 'af-ZA', source: 'preference' });
  });

  it('builds language directives for explicit and auto-detected turns', () => {
    expect(
      buildLanguageDirectiveForTurn({ locale: 'af-ZA', source: 'explicit_override' })
    ).toContain('LANGUAGE OVERRIDE');

    expect(
      buildLanguageDirectiveForTurn({ locale: 'zu-ZA', source: 'auto_detect' })
    ).toContain('AUTO-DETECTED');
  });
});
