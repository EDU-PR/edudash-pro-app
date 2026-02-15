/**
 * sentenceSplitter — Extracts complete sentences/clauses from a streaming text buffer.
 * Used by useOrbStreaming to fire TTS as early as possible.
 */

const SENTENCE_END = /([.!?])\s+/;
const CLAUSE_END = /([;:])\s+/;
/** Max chars before force-splitting at last space */
const HARD_MAX = 140;
/** Min chars before attempting clause-level split */
const CLAUSE_MIN = 60;

export function extractCompleteSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let rest = buffer;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // 1. Prefer sentence-end boundaries (.!?)
    const match = SENTENCE_END.exec(rest);
    if (match) {
      const end = match.index + match[1].length;
      const sentence = rest.slice(0, end).trim();
      if (sentence.length > 0) sentences.push(sentence);
      rest = rest.slice(end).trimStart();
      continue;
    }

    // 2. If buffer is long enough, try clause boundaries (;:)
    if (rest.length >= CLAUSE_MIN) {
      const clauseMatch = CLAUSE_END.exec(rest);
      if (clauseMatch) {
        const end = clauseMatch.index + clauseMatch[1].length;
        const sentence = rest.slice(0, end).trim();
        if (sentence.length > 0) sentences.push(sentence);
        rest = rest.slice(end).trimStart();
        continue;
      }
    }

    // 3. Hard-max fallback: force-split at last space to prevent TTS starvation
    if (rest.length >= HARD_MAX) {
      const lastSpace = rest.lastIndexOf(' ', HARD_MAX);
      if (lastSpace > 30) {
        const sentence = rest.slice(0, lastSpace).trim();
        if (sentence.length > 0) sentences.push(sentence);
        rest = rest.slice(lastSpace).trimStart();
        continue;
      }
    }

    break;
  }

  return { sentences, remainder: rest };
}
