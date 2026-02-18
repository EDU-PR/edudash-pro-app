/**
 * visemeEstimator — Phoneme-to-viseme mapping for lip-sync animation
 *
 * Estimates viseme IDs and timing from text, providing MUCH better
 * lip-sync than random cycling. Uses the standard Azure viseme ID
 * set (0–21) which DashOrb.tsx already supports via `visemeToAnimation()`.
 *
 * When Azure TTS returns real viseme data (via WebSocket API), those
 * will override these estimates. This is the offline fallback.
 *
 * Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
 *
 * ≤200 lines (WARP.md).
 */

export interface VisemeEvent {
  /** Azure viseme ID (0–21) */
  visemeId: number;
  /** Milliseconds from the start of the sentence */
  offsetMs: number;
  /** Duration of this viseme in ms */
  durationMs: number;
}

// ── Phoneme → Viseme mapping (Azure standard) ──────────────────────────
// Groups based on mouth shape — simplified English approximation.

// Viseme 0  = silence / rest
// Viseme 1  = æ, ə, ʌ (open mid vowels: "a" in "cat", "u" in "cup")
// Viseme 2  = ɑː (open vowel: "a" in "father")
// Viseme 3  = ɔː (rounded: "o" in "thought")
// Viseme 4  = ɛ, e (mid front: "e" in "bed")
// Viseme 5  = ɜː (open mid central: "er" in "bird")
// Viseme 6  = iː, ɪ (close front: "ee" in "see")
// Viseme 7  = w, ʊ (rounded close: "w", "oo" in "book")
// Viseme 8  = uː (close back: "oo" in "food")
// Viseme 11 = aɪ, aʊ (diphthongs: "i" in "like", "ow" in "how")
// Viseme 12 = ɔɪ (diphthong: "oi" in "boy")
// Viseme 13 = ʃ, ʒ, tʃ, dʒ (postalveolar: "sh", "ch", "j")
// Viseme 14 = s, z (alveolar fricative: "s", "z")
// Viseme 15 = n, d, t, l (alveolar: tongue to ridge)
// Viseme 16 = r (retroflex)
// Viseme 17 = k, g, ŋ (velar: "k", "g")
// Viseme 18 = f, v (labiodental: "f", "v")
// Viseme 19 = ð, θ (dental: "th")
// Viseme 20 = m, p, b (bilabial: lips together)
// Viseme 21 = sil (silence)

const CHAR_VISEME: Record<string, number> = {
  a: 1, e: 4, i: 6, o: 3, u: 8,
  b: 20, c: 14, d: 15, f: 18, g: 17,
  h: 0, j: 13, k: 17, l: 15, m: 20,
  n: 15, p: 20, q: 17, r: 16, s: 14,
  t: 15, v: 18, w: 7, x: 14, y: 6, z: 14,
};

const PHONICS_MARKER_TO_VISEME: Record<string, number> = {
  m: 20,
  n: 15,
  s: 14,
  f: 18,
  v: 18,
  z: 14,
  l: 15,
  r: 16,
  th: 19,
  sh: 13,
  ch: 13,
};

const PHONICS_SUSTAINED_SOUND_TO_TOKEN: Record<string, string> = {
  sss: 's', mmm: 'm', fff: 'f', zzz: 'z', nnn: 'n', lll: 'l',
  rrr: 'r', vvv: 'v', hhh: 'h',
  buh: 'b', duh: 'd', tuh: 't', puh: 'p', guh: 'g', kuh: 'k',
  juh: 'j', wuh: 'w', yuh: 'y',
  ah: 'a', eh: 'e', ih: 'i', aw: 'o', uh: 'u',
};

// Digraph overrides (checked first)
const DIGRAPH_VISEME: Array<[string, number]> = [
  ['th', 19],
  ['sh', 13],
  ['ch', 13],
  ['ph', 18],
  ['wh', 7],
  ['oo', 8],
  ['ee', 6],
  ['ai', 11],
  ['ay', 11],
  ['ow', 11],
  ['ou', 11],
  ['oi', 12],
  ['oy', 12],
  ['ng', 17],
  ['ck', 17],
];

// Average phoneme duration in ms (natural speech ~80-120ms per phoneme)
const PHONEME_DURATION_MS = 85;
// Pause between words
const WORD_GAP_MS = 40;
// Silence at sentence boundaries
const SILENCE_MS = 120;
// Held consonants for phonics mode
const PHONICS_SUSTAINED_DURATION_MS = 280;
const PHONICS_MARKER_SILENCE_MS = 200;

/**
 * Estimate a viseme timeline from plain text.
 *
 * Returns an array of VisemeEvents with approximate
 * offsets so the DashOrb visualizer can animate lip shapes
 * in sync with TTS playback.
 */
export function estimateVisemeTimeline(text: string): VisemeEvent[] {
  if (!text || text.trim().length === 0) return [];

  const events: VisemeEvent[] = [];
  const words = text.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/).filter(Boolean);
  let offsetMs = 0;

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    let i = 0;

    while (i < word.length) {
      let visemeId = 0;
      let consumed = 1;

      // Check digraphs first
      if (i + 1 < word.length) {
        const pair = word.slice(i, i + 2);
        const match = DIGRAPH_VISEME.find(([d]) => d === pair);
        if (match) {
          visemeId = match[1];
          consumed = 2;
        }
      }

      // Single char fallback
      if (consumed === 1) {
        const ch = word[i];
        if (ch === "'") {
          i++;
          continue;
        }
        visemeId = CHAR_VISEME[ch] ?? 0;
      }

      events.push({
        visemeId,
        offsetMs,
        durationMs: PHONEME_DURATION_MS,
      });

      offsetMs += PHONEME_DURATION_MS;
      i += consumed;
    }

    // Word gap
    if (w < words.length - 1) {
      events.push({ visemeId: 0, offsetMs, durationMs: WORD_GAP_MS });
      offsetMs += WORD_GAP_MS;
    }
  }

  // Terminal silence
  events.push({ visemeId: 21, offsetMs, durationMs: SILENCE_MS });

  return events;
}

function normalizePhonicsToken(tokenRaw: string): string {
  const token = String(tokenRaw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!token) return '';
  return PHONICS_SUSTAINED_SOUND_TO_TOKEN[token] || token;
}

/**
 * Estimate viseme timeline for phonics-focused utterances.
 * Marker examples: /m/, /s/, /n/, [sh], [th]
 */
export function estimateVisemeTimelinePhonics(text: string): VisemeEvent[] {
  if (!text || text.trim().length === 0) return [];

  const markerRegex = /\/\s*([a-z]{1,8})\s*\/|\[\s*([a-z]{1,8})\s*\]/gi;
  const markerMatches = Array.from(text.matchAll(markerRegex));
  if (markerMatches.length === 0) {
    return estimateVisemeTimeline(text);
  }

  const events: VisemeEvent[] = [];
  let offsetMs = 0;

  for (const match of markerMatches) {
    const rawToken = match[1] || match[2] || '';
    const token = normalizePhonicsToken(rawToken);
    if (!token) continue;

    const visemeId = PHONICS_MARKER_TO_VISEME[token];
    if (typeof visemeId !== 'number') {
      const fallback = estimateVisemeTimeline(token);
      const withoutTerminalSilence = fallback.filter((evt, idx) => idx < fallback.length - 1);
      for (const evt of withoutTerminalSilence) {
        events.push({
          visemeId: evt.visemeId,
          offsetMs: offsetMs + evt.offsetMs,
          durationMs: evt.durationMs,
        });
      }
      if (withoutTerminalSilence.length > 0) {
        const last = withoutTerminalSilence[withoutTerminalSilence.length - 1];
        offsetMs += last.offsetMs + last.durationMs;
      }
      continue;
    }

    events.push({ visemeId, offsetMs, durationMs: PHONICS_SUSTAINED_DURATION_MS });
    offsetMs += PHONICS_SUSTAINED_DURATION_MS;

    // Mirror phonics SSML marker breaks with a visible rest viseme.
    events.push({ visemeId: 21, offsetMs, durationMs: PHONICS_MARKER_SILENCE_MS });
    offsetMs += PHONICS_MARKER_SILENCE_MS;
  }

  if (events.length === 0) {
    return estimateVisemeTimeline(text);
  }

  return events;
}
