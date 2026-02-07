/**
 * Interactive Answer Detection for Preschool Voice ORB
 *
 * Parses the actual AI response to extract context-specific choices
 * that preschoolers can tap. Choices MUST correlate with the question
 * Dash just asked — never generic/hardcoded.
 *
 * Supports:
 * - Number counting (What comes after two?)
 * - Color identification (What colour is the sky?)
 * - Shape recognition (What shape is a ball?)
 * - Yes/No questions (Should Benny share?)
 * - Letter/word choices (What sound does B make?)
 * - Multiple choice (Is it A, B, or C?)
 *
 * @module lib/dash-interactive-choices
 */

// ── Types ────────────────────────────────────────────────────────────

export interface InteractiveChoice {
  label: string;
  value: string;
  type: 'number' | 'color' | 'shape' | 'word' | 'yesno' | 'letter';
}

// ── Constants ────────────────────────────────────────────────────────

const ALL_COLORS = ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'white', 'black', 'brown'];
const ALL_SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'rectangle', 'oval'];
const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function getColorEmoji(color: string): string {
  const map: Record<string, string> = {
    red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢',
    orange: '🟠', purple: '🟣', pink: '💗', white: '⬜',
    black: '⬛', brown: '🟤',
  };
  return map[color] || '⬜';
}

function getShapeEmoji(shape: string): string {
  const map: Record<string, string> = {
    circle: '⭕', square: '🟧', triangle: '🔺',
    star: '⭐', heart: '💜', diamond: '🔷',
    rectangle: '▬', oval: '🏈',
  };
  return map[shape] || '🔷';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Extraction Helpers ───────────────────────────────────────────────

/** Find colors explicitly mentioned in the text */
function extractMentionedColors(text: string): string[] {
  const lower = text.toLowerCase();
  return ALL_COLORS.filter((c) => {
    const regex = new RegExp('\\b' + c + '\\b', 'i');
    return regex.test(lower);
  });
}

/** Find shapes explicitly mentioned in the text */
function extractMentionedShapes(text: string): string[] {
  const lower = text.toLowerCase();
  return ALL_SHAPES.filter((s) => {
    const regex = new RegExp('\\b' + s + 's?\\b', 'i');
    return regex.test(lower);
  });
}

/** Find numbers (words or digits) mentioned in the text */
function extractMentionedNumbers(text: string): number[] {
  const found = new Set<number>();
  for (const [word, num] of Object.entries(NUM_WORDS)) {
    const regex = new RegExp('\\b' + word + '\\b', 'i');
    if (regex.test(text)) found.add(num);
  }
  const digitMatches = text.match(/\b(\d{1,2})\b/g);
  if (digitMatches) {
    for (const d of digitMatches) {
      const n = parseInt(d, 10);
      if (n >= 0 && n <= 20) found.add(n);
    }
  }
  return Array.from(found).sort((a, b) => a - b);
}

/** Extract the question portion (last sentence with ?) */
function extractQuestion(text: string): string {
  const sentences = text.split(/[.!]\s+/);
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].includes('?')) return sentences[i];
  }
  return text;
}

/** Check if text contains explicit listed options like "A, B, or C" */
function extractListedOptions(text: string): string[] | null {
  // Pattern: "X, Y, or Z?" or "X, Y, and Z?"
  const orMatch = text.match(/\b([\w']+(?:\s[\w']+)?),\s+([\w']+(?:\s[\w']+)?),?\s+or\s+([\w']+(?:\s[\w']+)?)\s*\?/i);
  if (orMatch) {
    return [orMatch[1].trim(), orMatch[2].trim(), orMatch[3].trim()];
  }
  // Pattern: "Is it X or Y?"
  const simpleOr = text.match(/is it\s+([\w']+(?:\s[\w']+)?)\s+or\s+([\w']+(?:\s[\w']+)?)\s*\?/i);
  if (simpleOr) {
    return [simpleOr[1].trim(), simpleOr[2].trim()];
  }
  return null;
}

// ── Main Detection ───────────────────────────────────────────────────

/**
 * Detect interactive choices from the actual AI response content.
 * Choices are context-aware — extracted from what the AI actually asked.
 *
 * Only active for preschool org type — older learners use text/voice.
 */
export function detectInteractiveChoices(
  text: string,
  orgType: string,
): InteractiveChoice[] {
  if (orgType !== 'preschool') return [];
  if (!text.includes('?')) return [];

  const question = extractQuestion(text);
  const qLower = question.toLowerCase();

  // ── Check for explicit listed options first ───────────────────────
  const listedOptions = extractListedOptions(question);
  if (listedOptions && listedOptions.length >= 2) {
    const allColors = listedOptions.every((o) => ALL_COLORS.includes(o.toLowerCase()));
    const allShapes = listedOptions.every((o) => ALL_SHAPES.includes(o.toLowerCase()));
    const allNumbers = listedOptions.every((o) => NUM_WORDS[o.toLowerCase()] !== undefined || /^\d+$/.test(o));

    if (allColors) {
      return listedOptions.map((c) => ({
        label: getColorEmoji(c.toLowerCase()) + ' ' + capitalize(c),
        value: c, type: 'color' as const,
      }));
    }
    if (allShapes) {
      return listedOptions.map((s) => ({
        label: getShapeEmoji(s.toLowerCase()) + ' ' + capitalize(s),
        value: s, type: 'shape' as const,
      }));
    }
    if (allNumbers) {
      return listedOptions.map((n) => {
        const num = NUM_WORDS[n.toLowerCase()] ?? parseInt(n, 10);
        return { label: String(num), value: String(num), type: 'number' as const };
      });
    }
    return listedOptions.map((w) => ({
      label: capitalize(w), value: w, type: 'word' as const,
    }));
  }

  // ── Number / Counting questions ───────────────────────────────────
  const numberQ = /what comes after|how many|can you count|what number|count to|plus|add|minus|take away|comes next|comes before/i;
  if (numberQ.test(question)) {
    const mentioned = extractMentionedNumbers(text);
    if (mentioned.length > 0) {
      const last = mentioned[mentioned.length - 1];
      if (/comes after|comes next/i.test(question)) {
        const choices = [last, last + 1, last + 2].filter((n) => n >= 0 && n <= 20);
        return choices.map((n) => ({ label: String(n), value: String(n), type: 'number' as const }));
      }
      if (/how many/i.test(question) && mentioned.length === 1) {
        const answer = last;
        const choices = [...new Set([Math.max(0, answer - 1), answer, answer + 1])];
        return choices.map((n) => ({ label: String(n), value: String(n), type: 'number' as const }));
      }
      if (mentioned.length >= 2) {
        return mentioned.slice(0, 4).map((n) => ({
          label: String(n), value: String(n), type: 'number' as const,
        }));
      }
      const choices = [...new Set([Math.max(0, last - 1), last, last + 1])];
      return choices.map((n) => ({
        label: String(n), value: String(n), type: 'number' as const,
      }));
    }
    return [1, 2, 3, 4, 5].map((n) => ({
      label: String(n), value: String(n), type: 'number' as const,
    }));
  }

  // ── Color questions ───────────────────────────────────────────────
  const colorQ = /what colo[u]?r|which colo[u]?r|is it (red|blue|green|yellow|orange|purple|pink|white|black|brown)|favourite colo[u]?r|what.*colo[u]?r/i;
  if (colorQ.test(question)) {
    const mentioned = extractMentionedColors(text);
    if (mentioned.length >= 2) {
      return mentioned.slice(0, 4).map((c) => ({
        label: getColorEmoji(c) + ' ' + capitalize(c),
        value: capitalize(c), type: 'color' as const,
      }));
    }
    const contextColors = inferContextColors(text);
    if (contextColors.length >= 2) {
      return contextColors.slice(0, 4).map((c) => ({
        label: getColorEmoji(c) + ' ' + capitalize(c),
        value: capitalize(c), type: 'color' as const,
      }));
    }
    const pool = [...new Set([...mentioned, 'red', 'blue', 'yellow', 'green'])];
    return pool.slice(0, 4).map((c) => ({
      label: getColorEmoji(c) + ' ' + capitalize(c),
      value: capitalize(c), type: 'color' as const,
    }));
  }

  // ── Shape questions ───────────────────────────────────────────────
  const shapeQ = /what shape|which shape|is it a (circle|square|triangle|star|heart|diamond|rectangle|oval)|how many sides/i;
  if (shapeQ.test(question)) {
    const mentioned = extractMentionedShapes(text);
    if (mentioned.length >= 2) {
      return mentioned.slice(0, 4).map((s) => ({
        label: getShapeEmoji(s) + ' ' + capitalize(s),
        value: capitalize(s), type: 'shape' as const,
      }));
    }
    const contextShapes = inferContextShapes(text);
    if (contextShapes.length >= 2) {
      return contextShapes.slice(0, 4).map((s) => ({
        label: getShapeEmoji(s) + ' ' + capitalize(s),
        value: capitalize(s), type: 'shape' as const,
      }));
    }
    const pool = [...new Set([...mentioned, 'circle', 'square', 'triangle'])];
    return pool.slice(0, 4).map((s) => ({
      label: getShapeEmoji(s) + ' ' + capitalize(s),
      value: capitalize(s), type: 'shape' as const,
    }));
  }

  // ── Letter sound questions ────────────────────────────────────────
  const letterQ = /what sound does|what letter|which letter|starts with|the letter|sound of the letter/i;
  if (letterQ.test(question)) {
    const letterMatch = text.match(/\bletter\s+([A-Z])\b/i) || text.match(/\b([A-Z])\b.*(?:sound|starts)/i);
    if (letterMatch) {
      const target = letterMatch[1].toUpperCase();
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const idx = alphabet.indexOf(target);
      const distractors = [alphabet[(idx + 3) % 26], alphabet[(idx + 7) % 26]];
      return [target, ...distractors].sort().map((l) => ({
        label: l, value: l, type: 'letter' as const,
      }));
    }
  }

  // ── Yes/No questions — only when genuinely binary ─────────────────
  const yesNoQ = /should .+ (share|help|go|try|eat|play|stop)|do you (think|want|like)|did .+ (do|find|see|make)|is that (right|correct)|shall we|want to try|want to (count|sing|play|learn)/i;
  if (yesNoQ.test(question) && qLower.includes('?')) {
    return [
      { label: '👍 Yes!', value: 'Yes', type: 'yesno' as const },
      { label: '👎 No', value: 'No', type: 'yesno' as const },
    ];
  }

  return [];
}

// ── Context Inference Helpers ────────────────────────────────────────

/** Infer likely color answer from object context ("sky"→blue, "grass"→green) */
function inferContextColors(text: string): string[] {
  const lower = text.toLowerCase();
  const contextMap: Record<string, string[]> = {
    sky: ['blue', 'white'],
    sun: ['yellow', 'orange'],
    grass: ['green', 'brown'],
    tree: ['green', 'brown'],
    leaf: ['green', 'yellow', 'brown'],
    apple: ['red', 'green', 'yellow'],
    banana: ['yellow', 'green'],
    tomato: ['red', 'green'],
    carrot: ['orange', 'green'],
    milk: ['white'],
    chocolate: ['brown', 'white'],
    fire: ['red', 'orange', 'yellow'],
    water: ['blue', 'white'],
    night: ['black', 'blue'],
    snow: ['white'],
    strawberry: ['red', 'pink'],
    ocean: ['blue', 'green'],
    cloud: ['white', 'blue'],
    flower: ['red', 'yellow', 'pink', 'purple'],
  };

  const likelyColors: string[] = [];
  for (const [object, colors] of Object.entries(contextMap)) {
    if (lower.includes(object)) {
      likelyColors.push(...colors);
    }
  }

  if (likelyColors.length > 0) {
    const common = ['red', 'blue', 'yellow', 'green'];
    for (const c of common) {
      if (!likelyColors.includes(c)) likelyColors.push(c);
      if (likelyColors.length >= 4) break;
    }
  }
  return [...new Set(likelyColors)].slice(0, 4);
}

/** Infer likely shape answer from object context ("ball"→circle, "box"→square) */
function inferContextShapes(text: string): string[] {
  const lower = text.toLowerCase();
  const contextMap: Record<string, string[]> = {
    ball: ['circle', 'square'],
    wheel: ['circle', 'triangle'],
    clock: ['circle', 'square'],
    box: ['square', 'rectangle', 'circle'],
    door: ['rectangle', 'square'],
    window: ['square', 'rectangle', 'circle'],
    pizza: ['circle', 'triangle'],
    sandwich: ['triangle', 'square'],
    roof: ['triangle', 'square'],
    tent: ['triangle', 'square'],
    moon: ['circle', 'star'],
    coin: ['circle', 'square'],
    table: ['rectangle', 'circle', 'square'],
    book: ['rectangle', 'square'],
    plate: ['circle', 'oval'],
    egg: ['oval', 'circle'],
  };

  const likelyShapes: string[] = [];
  for (const [object, shapes] of Object.entries(contextMap)) {
    if (lower.includes(object)) {
      likelyShapes.push(...shapes);
    }
  }

  if (likelyShapes.length > 0) {
    const common = ['circle', 'square', 'triangle'];
    for (const s of common) {
      if (!likelyShapes.includes(s)) likelyShapes.push(s);
      if (likelyShapes.length >= 4) break;
    }
  }
  return [...new Set(likelyShapes)].slice(0, 4);
}
