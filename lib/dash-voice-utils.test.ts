import { splitForTTS, TTS_CHUNK_MAX_LEN } from './dash-voice-utils';

describe('dash-voice-utils', () => {
  describe('TTS_CHUNK_MAX_LEN', () => {
    it('is 1200', () => {
      expect(TTS_CHUNK_MAX_LEN).toBe(1200);
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
});
