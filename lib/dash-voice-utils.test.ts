import {
  buildVoicePlaybackText,
  splitForTTS,
  TTS_CHUNK_MAX_LEN,
  shouldEnableVoiceTurnTools,
} from './dash-voice-utils';

describe('dash-voice-utils', () => {
  describe('TTS_CHUNK_MAX_LEN', () => {
    it('is 1800', () => {
      expect(TTS_CHUNK_MAX_LEN).toBe(1800);
    });
  });

  describe('splitForTTS', () => {
    it('returns single chunk when text is short', () => {
      const text = 'Hello world.';
      expect(splitForTTS(text)).toEqual([text]);
    });

    it('returns empty array for empty string', () => {
      expect(splitForTTS('')).toEqual([]);
    });

    it('splits at sentence boundaries when over maxLen', () => {
      const s1 = 'First sentence here.';
      const s2 = 'Second sentence here.';
      const long = s1.repeat(70) + ' ' + s2.repeat(70);
      const chunks = splitForTTS(long);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TTS_CHUNK_MAX_LEN);
      });
    });

    it('respects custom maxLen', () => {
      const text = 'A. B. C. D. E.';
      const chunks = splitForTTS(text, 3);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(3);
      });
    });

    it('defaults to TTS_CHUNK_MAX_LEN when maxLen not passed', () => {
      const long = 'A. '.repeat(500);
      const chunks = splitForTTS(long);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(TTS_CHUNK_MAX_LEN);
      });
    });
  });

  describe('buildVoicePlaybackText', () => {
    it('returns original text when already short', () => {
      const text = 'This is short and clear.';
      expect(buildVoicePlaybackText(text)).toBe(text);
    });

    it('returns concise spoken text when response is long', () => {
      const text = [
        'First sentence is helpful and complete.',
        'Second sentence adds context for the listener.',
        'Third sentence should usually be omitted for faster speech playback.',
      ].join(' ');
      const spoken = buildVoicePlaybackText(text, { maxChars: 120, maxSentences: 2 });
      expect(spoken.length).toBeLessThanOrEqual(120);
      expect(spoken).toContain('First sentence');
      expect(spoken).not.toContain('Third sentence');
    });
  });

  describe('shouldEnableVoiceTurnTools', () => {
    it('enables tools for explicit PDF/export prompts', () => {
      expect(shouldEnableVoiceTurnTools('Please export this as a PDF for me')).toBe(true);
    });

    it('enables tools for web-search-like prompts', () => {
      expect(shouldEnableVoiceTurnTools('What is the latest weather forecast today?')).toBe(true);
    });

    it('keeps tools deferred for normal tutoring prompts', () => {
      expect(shouldEnableVoiceTurnTools('Explain fractions to grade four learners')).toBe(false);
    });

    it('keeps tools deferred when OCR mode is active', () => {
      expect(shouldEnableVoiceTurnTools('Read this worksheet image', { ocrMode: true })).toBe(false);
    });
  });
});
