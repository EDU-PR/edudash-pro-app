import { formatTranscript } from '../formatTranscript';

describe('formatTranscript whisper flow', () => {
  it('fixes common STT phrase mistakes', () => {
    const out = formatTranscript('it socks', 'en-ZA', { whisperFlow: true });
    expect(out).toBe("It's socks.");
  });

  it('normalizes phonics repeated letters into slash markers', () => {
    const out = formatTranscript('letter sound s s s please', 'en-ZA', { whisperFlow: true });
    expect(out).toContain('/s/');
    expect(out).not.toContain('s s s');
  });

  it('stabilizes acronym dictation for prompts', () => {
    const out = formatTranscript('can you generate a p d f for grade four', 'en-ZA', {
      whisperFlow: true,
    });
    expect(out).toContain('PDF');
  });

  it('summarizes long transcript when enabled', () => {
    const out = formatTranscript(
      'Can you help me understand this maths problem because I am trying to solve it and I keep getting confused about fractions and denominators and numerators in the same question',
      'en-ZA',
      { whisperFlow: true, summarize: true, maxSummaryWords: 12 }
    );
    const words = out.split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(13); // allow trailing punctuation tokenization variance
  });

  it('keeps filler words in preschool mode', () => {
    const out = formatTranscript('um can you help me', 'en-ZA', {
      whisperFlow: true,
      preschoolMode: true,
    });
    expect(out.toLowerCase()).toContain('um');
  });

  it('does not force phonics markers for normal speech phrasing', () => {
    const out = formatTranscript('that sounds like a good plan for class', 'en-ZA', {
      whisperFlow: true,
    });
    expect(out).not.toContain('/s/');
    expect(out.toLowerCase()).toContain('sounds');
    expect(out.toLowerCase()).toContain('good plan');
  });
});
