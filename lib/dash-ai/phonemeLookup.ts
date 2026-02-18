/**
 * PHONEME_LOOKUP — Master phoneme dictionary with IPA symbols, mouth
 * position tips, and bilingual SSML generation for South African languages.
 *
 * Keyed by BCP-47 language tag (en-ZA, zu-ZA, af-ZA).
 * Each entry includes:
 *   - ipa: International Phonetic Alphabet symbol
 *   - sound: human-readable pronunciation guide
 *   - mouthTip: short description of lip/tongue position for score < 60
 *   - example: word demonstrating the sound
 *
 * @module phonemeLookup
 * @see phonics.ts — letter-level maps used by tutor prompts
 * @see pronunciationDictionary.ts — word-level SSML substitutions
 * @see tts-proxy/index.ts — Edge Function that consumes SSML
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhonemeEntry {
  /** IPA symbol */
  ipa: string;
  /** Human-readable pronunciation guide */
  sound: string;
  /** Mouth/tongue position tip for coaching (shown when accuracy < 60) */
  mouthTip: string;
  /** Example word */
  example: string;
}

export type PhonemeLanguage = 'en-ZA' | 'zu-ZA' | 'af-ZA';

// ---------------------------------------------------------------------------
// en-ZA — South African English phonemes
// ---------------------------------------------------------------------------

const EN_ZA_PHONEMES: Record<string, PhonemeEntry> = {
  // --- Vowels (SA English) ---
  'short_a': {
    ipa: 'æ',
    sound: 'ah (short)',
    mouthTip: 'Open your mouth wide, tongue flat and low — like you\'re showing the doctor.',
    example: 'cat',
  },
  'long_a': {
    ipa: 'eɪ',
    sound: 'ay',
    mouthTip: 'Start with mouth open, then slide lips into a smile.',
    example: 'cake',
  },
  'short_e': {
    ipa: 'ɛ',
    sound: 'eh',
    mouthTip: 'Open your mouth slightly, tongue halfway up — relaxed smile.',
    example: 'bed',
  },
  'long_e': {
    ipa: 'iː',
    sound: 'ee',
    mouthTip: 'Pull your lips wide into a big smile, tongue high and forward.',
    example: 'tree',
  },
  'short_i': {
    ipa: 'ɪ',
    sound: 'ih',
    mouthTip: 'Small smile, tongue raised slightly — quick and short.',
    example: 'sit',
  },
  'long_i': {
    ipa: 'aɪ',
    sound: 'eye',
    mouthTip: 'Start with mouth wide open, then slide into a smile.',
    example: 'kite',
  },
  'short_o': {
    ipa: 'ɒ',
    sound: 'aw (short)',
    mouthTip: 'Round your lips into an "O" shape, tongue low.',
    example: 'hot',
  },
  'long_o': {
    ipa: 'oʊ',
    sound: 'oh',
    mouthTip: 'Round lips and push forward, like blowing a candle gently.',
    example: 'home',
  },
  'short_u': {
    ipa: 'ʌ',
    sound: 'uh',
    mouthTip: 'Relax your mouth, barely open — like a lazy "ah".',
    example: 'cup',
  },
  'long_u': {
    ipa: 'juː',
    sound: 'yoo',
    mouthTip: 'Start with a "y" sound then push lips into a tight circle.',
    example: 'cube',
  },
  // --- Consonants (SA English specifics) ---
  'long_s': {
    ipa: 'sːː',
    sound: 'sss (long)',
    mouthTip: 'Push tongue behind top teeth, keep lips apart, hiss like a snake.',
    example: 'snake',
  },
  'rhotic_r': {
    ipa: 'ɹ',
    sound: 'rrr',
    mouthTip: 'Curl tongue tip up toward the roof of your mouth — don\'t touch!',
    example: 'rabbit',
  },
  'th_voiceless': {
    ipa: 'θ',
    sound: 'th (soft)',
    mouthTip: 'Stick tongue tip between teeth and blow air gently.',
    example: 'think',
  },
  'th_voiced': {
    ipa: 'ð',
    sound: 'th (buzzy)',
    mouthTip: 'Tongue between teeth, but hum/buzz — feel the vibration.',
    example: 'this',
  },
  'sh': {
    ipa: 'ʃ',
    sound: 'sh',
    mouthTip: 'Lips pushed forward in a round shape, tongue flat behind teeth.',
    example: 'ship',
  },
  'ch': {
    ipa: 'tʃ',
    sound: 'ch',
    mouthTip: 'Start with tongue pressed on roof, then release with a rush of air.',
    example: 'chip',
  },
  'ng': {
    ipa: 'ŋ',
    sound: 'ng',
    mouthTip: 'Back of tongue touches soft palate — hum through your nose.',
    example: 'sing',
  },
  'j': {
    ipa: 'dʒ',
    sound: 'juh',
    mouthTip: 'Tongue presses roof then drops — like a soft explosion.',
    example: 'jam',
  },
  'w': {
    ipa: 'w',
    sound: 'wuh',
    mouthTip: 'Round your lips tightly then open quickly.',
    example: 'water',
  },
  'y': {
    ipa: 'j',
    sound: 'yuh',
    mouthTip: 'Tongue high and forward, lips relaxed — slides into the next vowel.',
    example: 'yellow',
  },
  // --- Single-letter phonemes (for /s/, /m/, /b/, etc.) ---
  's': {
    ipa: 's',
    sound: 'sss',
    mouthTip: 'Push tongue behind top teeth, keep lips apart, hiss like a snake.',
    example: 'sun',
  },
  'm': {
    ipa: 'm',
    sound: 'mmm',
    mouthTip: 'Press your lips together and hum — feel the buzz on your lips.',
    example: 'mat',
  },
  'b': {
    ipa: 'b',
    sound: 'buh',
    mouthTip: 'Press lips together, build up air, then pop them open.',
    example: 'bat',
  },
  'd': {
    ipa: 'd',
    sound: 'duh',
    mouthTip: 'Tongue tip taps behind top teeth, then release.',
    example: 'dog',
  },
  't': {
    ipa: 't',
    sound: 'tuh',
    mouthTip: 'Tongue tip taps behind top teeth, then release with a puff of air.',
    example: 'top',
  },
  'p': {
    ipa: 'p',
    sound: 'puh',
    mouthTip: 'Press lips together, build up air, then pop them open.',
    example: 'pat',
  },
  'g': {
    ipa: 'ɡ',
    sound: 'guh',
    mouthTip: 'Back of tongue touches soft palate, then release.',
    example: 'go',
  },
  'k': {
    ipa: 'k',
    sound: 'kuh',
    mouthTip: 'Back of tongue touches soft palate, then release with a puff of air.',
    example: 'cat',
  },
  'f': {
    ipa: 'f',
    sound: 'fff',
    mouthTip: 'Top teeth touch bottom lip, blow air through gently.',
    example: 'fish',
  },
  'n': {
    ipa: 'n',
    sound: 'nnn',
    mouthTip: 'Tongue tip taps behind top teeth, hum through your nose.',
    example: 'net',
  },
  'l': {
    ipa: 'l',
    sound: 'lll',
    mouthTip: 'Tongue tip touches behind top teeth, let sound flow out the sides.',
    example: 'leg',
  },
  'r': {
    ipa: 'ɹ',
    sound: 'rrr',
    mouthTip: 'Curl tongue tip up toward the roof of your mouth — don\'t touch!',
    example: 'rabbit',
  },
};

// ---------------------------------------------------------------------------
// zu-ZA — isiZulu click consonants + key sounds
// ---------------------------------------------------------------------------

const ZU_ZA_PHONEMES: Record<string, PhonemeEntry> = {
  // --- Click consonants ---
  'c_click': {
    ipa: 'kǀ',
    sound: 'tsk (dental click)',
    mouthTip: 'Press tongue tip on the back of your top front teeth. Pull it down sharply — like a "tsk tsk" sound.',
    example: 'icici (earring)',
  },
  'q_click': {
    ipa: 'kǃ',
    sound: 'pop (postalveolar click)',
    mouthTip: 'Press tongue firmly on the roof of your mouth, about halfway back. Pull it down sharply — like uncorking a bottle.',
    example: 'iqaqa (polecat)',
  },
  'x_click': {
    ipa: 'kǁ',
    sound: 'cluck (lateral click)',
    mouthTip: 'Press tongue on one side against your cheek teeth. Pull it away sideways — like calling a horse.',
    example: 'ixoxo (frog)',
  },
  // --- Voiced clicks ---
  'gc_click': {
    ipa: 'ɠǀ',
    sound: 'voiced tsk',
    mouthTip: 'Same as "c" click but hum while you click — feel your throat vibrate.',
    example: 'gcina (keep)',
  },
  'gq_click': {
    ipa: 'ɠǃ',
    sound: 'voiced pop',
    mouthTip: 'Same as "q" click but hum — your voice box should vibrate.',
    example: 'gqoka (dress)',
  },
  'gx_click': {
    ipa: 'ɠǁ',
    sound: 'voiced cluck',
    mouthTip: 'Same as "x" click but add your voice — buzz while clicking.',
    example: 'gxeka (criticize)',
  },
  // --- Nasal clicks ---
  'nc_click': {
    ipa: 'ŋǀ',
    sound: 'nasal tsk',
    mouthTip: 'Let air flow through your nose while making the "c" click. Hum "nn" as you click.',
    example: 'ncane (small)',
  },
  'nq_click': {
    ipa: 'ŋǃ',
    sound: 'nasal pop',
    mouthTip: 'Hum "nn" through your nose while doing the "q" click.',
    example: 'nqola (wagon)',
  },
  'nx_click': {
    ipa: 'ŋǁ',
    sound: 'nasal cluck',
    mouthTip: 'Hum "nn" through your nose while pulling tongue sideways for the "x" click.',
    example: 'nxele (left hand)',
  },
  // --- Common isiZulu sounds ---
  'hl': {
    ipa: 'ɬ',
    sound: 'hl (voiceless lateral)',
    mouthTip: 'Put tongue on roof of mouth like an "L" but blow air out the sides — no voice.',
    example: 'hlala (sit)',
  },
  'dl': {
    ipa: 'ɮ',
    sound: 'dl (voiced lateral)',
    mouthTip: 'Same position as "hl" but add your voice — feel the buzz.',
    example: 'dlala (play)',
  },
  'mb': {
    ipa: 'mb',
    sound: 'mb (prenasalized)',
    mouthTip: 'Hum "mmm" then pop your lips open for "b" — one smooth sound.',
    example: 'imbali (flower)',
  },
  'nd': {
    ipa: 'nd',
    sound: 'nd (prenasalized)',
    mouthTip: 'Hum "nnn" then tongue drops quickly for "d" — flows together.',
    example: 'indoda (man)',
  },
  'ng_zulu': {
    ipa: 'ŋɡ',
    sound: 'ng-g (prenasalized)',
    mouthTip: 'Hum "ng" in the back of your throat then release into "g".',
    example: 'ingane (child)',
  },
};

// ---------------------------------------------------------------------------
// af-ZA — Afrikaans specific sounds
// ---------------------------------------------------------------------------

const AF_ZA_PHONEMES: Record<string, PhonemeEntry> = {
  'g_velar': {
    ipa: 'x',
    sound: 'ghh (velar fricative)',
    mouthTip: 'Lift the back of your tongue toward your soft palate and blow air — like clearing your throat gently.',
    example: 'goed (good)',
  },
  'u_rounded': {
    ipa: 'œ',
    sound: 'uh (rounded)',
    mouthTip: 'Round your lips like "oh" but say "eh" — your lips shape one sound while your tongue does another.',
    example: 'huis (house)',
  },
  'y_front_rounded': {
    ipa: 'y',
    sound: 'uu (front rounded)',
    mouthTip: 'Pucker lips tightly and say "ee" — lips round, tongue forward and high.',
    example: 'uur (hour)',
  },
  // Digraphs
  'aa': {
    ipa: 'ɑː',
    sound: 'aah (long)',
    mouthTip: 'Open mouth wide, tongue flat and back — hold the sound.',
    example: 'naam (name)',
  },
  'ee': {
    ipa: 'eː',
    sound: 'eh-eh (long)',
    mouthTip: 'Half-smile, tongue mid-height — stretch the sound.',
    example: 'meer (lake)',
  },
  'oo': {
    ipa: 'oː',
    sound: 'oh-oh (long)',
    mouthTip: 'Round lips and hold — like a slow "oh".',
    example: 'boom (tree)',
  },
  'oe': {
    ipa: 'u',
    sound: 'oo',
    mouthTip: 'Tight round lips, tongue pulled back — sounds like English "oo" in "moon".',
    example: 'boek (book)',
  },
  'ei': {
    ipa: 'ɛi',
    sound: 'ay',
    mouthTip: 'Start with "eh" then glide to "ee" — your mouth closes into a smile.',
    example: 'reis (trip)',
  },
  'ou': {
    ipa: 'ɔu',
    sound: 'oh-oo',
    mouthTip: 'Start rounded then get tighter — lips move from open "oh" to small "oo".',
    example: 'oud (old)',
  },
  'ui': {
    ipa: 'œi',
    sound: 'oy',
    mouthTip: 'Rounded lips sliding forward into a smile — similar to English "oi" in "oil" but rounder.',
    example: 'huis (house)',
  },
  'tj': {
    ipa: 'tʃ',
    sound: 'ch',
    mouthTip: 'Tongue presses to roof then releases — same as English "ch".',
    example: 'tjop (chop)',
  },
  'dj': {
    ipa: 'dʒ',
    sound: 'j',
    mouthTip: 'Like "ch" but add your voice — tongue presses and releases with a buzz.',
    example: 'djembe',
  },
  'r_trill': {
    ipa: 'r',
    sound: 'rr (trilled)',
    mouthTip: 'Tongue tip vibrates against the ridge behind your top teeth — let it flutter.',
    example: 'rooi (red)',
  },
};

// ---------------------------------------------------------------------------
// Master PHONEME_LOOKUP
// ---------------------------------------------------------------------------

export const PHONEME_LOOKUP: Record<PhonemeLanguage, Record<string, PhonemeEntry>> = {
  'en-ZA': EN_ZA_PHONEMES,
  'zu-ZA': ZU_ZA_PHONEMES,
  'af-ZA': AF_ZA_PHONEMES,
};

// ---------------------------------------------------------------------------
// SA Slang Encouragement Phrases
// ---------------------------------------------------------------------------

export const SA_ENCOURAGEMENT = {
  excellent: ['Lekker!', 'Sharp sharp!', 'Awethu!', 'Eish, you nailed it!', 'Hundred percent!'],
  good: ['Not bad, hey!', 'Getting there!', 'Almost lekker!', 'Sharp!', 'Nice one!'],
  needsWork: ['Ag, try again!', 'Almost there, champ!', 'One more time, you got this!', 'Keep going, nè?'],
} as const;

/**
 * Pick a random SA encouragement phrase based on score bracket.
 */
export function getEncouragement(score: number): string {
  const bucket =
    score >= 80 ? SA_ENCOURAGEMENT.excellent :
    score >= 60 ? SA_ENCOURAGEMENT.good :
    SA_ENCOURAGEMENT.needsWork;
  return bucket[Math.floor(Math.random() * bucket.length)];
}

/**
 * Look up a phoneme entry by key and language.
 * Returns null if no match found.
 */
export function lookupPhoneme(
  key: string,
  lang: PhonemeLanguage = 'en-ZA'
): PhonemeEntry | null {
  const langMap = PHONEME_LOOKUP[lang];
  if (!langMap) return null;
  return langMap[key] ?? null;
}

/**
 * Find a phoneme entry by its IPA symbol across all languages.
 */
export function findPhonemeByIPA(
  ipa: string
): { lang: PhonemeLanguage; key: string; entry: PhonemeEntry } | null {
  for (const [lang, map] of Object.entries(PHONEME_LOOKUP)) {
    for (const [key, entry] of Object.entries(map)) {
      if (entry.ipa === ipa) {
        return { lang: lang as PhonemeLanguage, key, entry };
      }
    }
  }
  return null;
}

/**
 * Get the mouth tip for a specific phoneme.
 * Returns a coaching string suitable for display when accuracy < 60.
 */
export function getMouthTip(
  key: string,
  lang: PhonemeLanguage = 'en-ZA'
): string | null {
  const entry = lookupPhoneme(key, lang);
  return entry?.mouthTip ?? null;
}
