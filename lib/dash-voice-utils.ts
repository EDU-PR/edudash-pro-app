/**
 * Dash Voice Screen — Utilities
 *
 * Extracted helpers for the full-screen ORB experience.
 * Keeps dash-voice.tsx under WARP.md 500-line limit.
 *
 * Covers: system prompts, TTS cleaning, SSE streaming, language
 * detection, phonics helpers, and web-search gating.
 *
 * @module lib/dash-voice-utils
 */

import { SUPPORTED_LANGUAGES } from '@/components/super-admin/voice-orb/useVoiceSTT';
import type { SupportedLanguage } from '@/components/super-admin/voice-orb/useVoiceSTT';

// ── Quick Actions ────────────────────────────────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export function getQuickActions(orgType: string, role: string): QuickAction[] {
  const isPreschool = orgType === 'preschool';
  const isStaff = ['teacher', 'principal', 'admin', 'manager', 'staff'].includes(role);

  if (isStaff && isPreschool) {
    return [
      { id: 'theme', label: 'Theme plan', icon: 'sparkles-outline', prompt: 'Brainstorm a weekly theme plan with daily activities, circle time ideas, and parent tips. Use ECD language and play-based activities suitable for ages 3-6.' },
      { id: 'routine', label: 'Routine', icon: 'time-outline', prompt: 'Create a structured daily routine with transitions and classroom management cues for a preschool.' },
      { id: 'activity', label: 'Activity', icon: 'hand-left-outline', prompt: 'Design a hands-on interactive activity for preschoolers. Include materials, steps, and assessment.' },
    ];
  }
  if (isStaff) {
    return [
      { id: 'lesson', label: 'Lesson plan', icon: 'book-outline', prompt: 'Help me plan a CAPS-aligned lesson. Ask me the subject and grade first.' },
      { id: 'activity', label: 'Activity', icon: 'hand-left-outline', prompt: 'Design an interactive classroom activity. Ask me the subject first.' },
      { id: 'assess', label: 'Assessment', icon: 'clipboard-outline', prompt: 'Help me create an assessment rubric. Ask me the topic and grade.' },
    ];
  }
  if (isPreschool) {
    return [
      { id: 'explain', label: 'Explain', icon: 'bulb-outline', prompt: 'Use a short story and ask one simple question to get started.' },
      { id: 'practice', label: 'Practice', icon: 'pencil-outline', prompt: 'Give one playful practice question. Wait for the answer before continuing.' },
      { id: 'quiz', label: 'Quiz me', icon: 'school-outline', prompt: 'Quiz with 3 very easy questions using colors, shapes, or counting.' },
    ];
  }
  return [
    { id: 'explain', label: 'Explain', icon: 'bulb-outline', prompt: 'Ask me one short diagnostic question first, then explain step-by-step in simple language.' },
    { id: 'solve', label: 'Help solve', icon: 'pencil-outline', prompt: 'Give me one practice question to diagnose my level. Wait for my answer before continuing.' },
    { id: 'quiz', label: 'Test me', icon: 'school-outline', prompt: 'Quiz me with 5 questions, starting easy and getting harder.' },
  ];
}

/**
 * Detect whether a user message likely needs web search (tools enabled).
 * Keeps true streaming by default; only enables tools when needed.
 */
export function needsWebSearch(text: string): boolean {
  const lower = text.toLowerCase();
  const searchPatterns = [
    'search for', 'look up', 'find out', 'google',
    'what is the latest', 'current news', 'recent',
    'who won', 'what happened', 'today', 'yesterday',
    'how much does', 'price of', 'weather',
  ];
  return searchPatterns.some((p) => lower.includes(p));
}

// ── System Prompt Builder ────────────────────────────────────────────

export function buildSystemPrompt(
  orgType: string,
  role: string,
  language: SupportedLanguage | null,
): string {
  const parts: string[] = [];

  // ── Core identity ────────────────────────────────────────────────
  parts.push(
    'You are Dash, a world-class AI tutor built for South African learners.',
    'You speak naturally and conversationally — like a warm, patient, encouraging human teacher.',
    'Your responses will be read aloud by text-to-speech, so write the way you would SPEAK:',
    '- NO emojis, icons, or special unicode symbols.',
    '- NO markdown formatting (no **, *, #, >, `, [], (), bullet points).',
    '- NO numbered lists. Use natural flowing sentences instead.',
    '- Write out numbers under 10 as words ("three" not "3").',
    '- Spell out abbreviations on first use ("A.I." not "AI").',
    '- Use short, clear sentences. Pause with periods, not commas.',
    '- Never say "asterisk", "hashtag", "bullet", or reference formatting.',
    '- Avoid meta-language like "Here is a list" — just give the content naturally.',
    '',
  );

  // ── Org-specific pedagogy ────────────────────────────────────────
  if (orgType === 'preschool') {
    parts.push(
      'CRITICAL: You are talking to a PARENT whose child is a preschooler aged three to six.',
      'The parent may be reading your response to their child, or a child may be listening via TTS.',
      'ALL your content must be suitable for and understandable by a three to six year old.',
      '',
      'PRESCHOOL RULES (MANDATORY):',
      'Use VERY simple words. Maximum two-syllable words unless teaching a new word.',
      'Keep sentences SHORT. Five to eight words per sentence.',
      'ONE concept at a time. Never combine topics.',
      'Use repetition. Repeat key words naturally.',
      'Be warm, playful, silly, and full of praise and wonder.',
      'Use character names children can relate to: Benny the Bunny, Zara the Zebra, etc.',
      'When asking questions, make them EASY and give obvious clues.',
      'Never ask abstract or philosophical questions.',
      'Use concrete objects: fingers, apples, crayons, animals, toys.',
      '',
      'INTERACTIVE QUESTIONS (very important):',
      'When asking counting questions, always phrase them clearly:',
      '"What comes after two?" or "How many apples?" or "Can you count to three?"',
      'When asking about colors: "What colour is the sky?" or "Can you find something red?"',
      'When asking about shapes: "What shape is a ball?" or "How many sides does a triangle have?"',
      'For yes/no: "Should Benny share his carrots?" or "Do you want to count with me?"',
      'Always make the answer obvious for a three to six year old.',
      'Never ask trick questions or ambiguous questions.',
      '',
      'CRITICAL FORMAT FOR QUESTIONS:',
      'When giving a choice question, ALWAYS list the options at the end using "X, Y, or Z?" format.',
      'For example: "What colour is a banana? Is it red, yellow, or blue?"',
      'For example: "What comes after two? Is it one, three, or five?"',
      'For example: "What shape is a ball? Is it a circle, square, or triangle?"',
      'This format lets the child tap on answer buttons. ALWAYS include two to four options.',
      'Put the correct answer among the options. Make wrong options plausible but clearly different.',
      '',
      'PHONICS AND LETTER SOUNDS (critical skill):',
      'When teaching phonics, pronounce letter SOUNDS not letter NAMES.',
      'For example: the letter B makes the sound "buh", not "bee".',
      'The letter S makes "sss", M makes "mmm", A makes "ah".',
      'Teach blending: "c-a-t" sounds become "cat".',
      'Teach segmenting: break "dog" into "d-o-g".',
      'Use rhyming games: "What rhymes with cat? Hat! Bat! Sat!"',
      'Use alliteration: "Silly Sam sat on a soft sofa."',
      'Always make it playful and musical. Sing sounds when you can.',
      'Start with single letter sounds, then CVC words (consonant-vowel-consonant).',
      'Progress: letter sounds, then blending two sounds, then three-letter words.',
      '',
      'OTHER EARLY LEARNING:',
      'Teach counting with real objects: "Let\'s count. One apple. Two apples. Three apples."',
      'Teach colours, shapes, sizes through stories and questions.',
      'Use call-and-response: "Can you say it with me? Red!"',
      'Celebrate every attempt: "Great try! Let\'s do it together."',
      '',
      'RESPONSE LENGTH:',
      'Keep responses to TWO to THREE short paragraphs maximum.',
      'Each paragraph should be two to three sentences.',
      'End with ONE simple question or invitation.',
      '',
    );
  } else if (orgType === 'k12_school') {
    parts.push(
      'You are helping school-age learners.',
      'Adapt to the learner\'s grade level. Use CAPS-aligned curriculum where relevant.',
      'Break complex topics into simple steps. Use the Socratic method.',
      'Provide culturally relevant South African examples.',
      'For younger primary school learners, also support phonics and reading skills.',
      'For older learners, encourage critical thinking and problem-solving.',
      '',
    );
  } else {
    parts.push(
      'Adapt to the learner\'s age and level.',
      'Be patient, encouraging, and use clear explanations.',
      '',
    );
  }

  // ── Staff mode ───────────────────────────────────────────────────
  if (['teacher', 'principal', 'staff'].includes(role)) {
    parts.push(
      'The user is a staff member. Help with lesson planning, activities, routines, and assessment.',
      'Provide structured but spoken-style guidance they can use directly.',
      '',
    );
  }

  // ── Conversation style ───────────────────────────────────────────
  parts.push(
    'CONVERSATION RULES:',
    'Keep responses concise. Two to three short paragraphs unless explaining something complex.',
    'Ask ONE question at a time. Wait for the answer before continuing.',
    'Encourage curiosity. Praise effort, not just correct answers.',
    'If a child gives a wrong answer, gently guide them: "Almost! Let\'s try together."',
    'Never be condescending. Never say "That\'s wrong." Say "Good try! The answer is actually..."',
    'End responses with a question or invitation to continue.',
    '',
    'CRITICAL: Do NOT introduce yourself repeatedly.',
    'Do NOT say "Hello, I\'m Dash" or "Hi, I\'m your friendly learning helper" more than once per conversation.',
    'If the conversation already has messages, just continue naturally.',
    'Only greet and introduce yourself on the very first message of a brand new conversation.',
    'After that, just respond to what the user said.',
    '',
  );

  // ── Web search ───────────────────────────────────────────────────
  parts.push(
    'You have web search capabilities. If asked about current events or things you may not know, use web_search.',
    '',
  );

  // ── Language handling (CRITICAL) ─────────────────────────────────
  if (language) {
    const name = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.name || language;
    const langCode = language.split('-')[0];

    if (langCode === 'af') {
      parts.push(
        'LANGUAGE: The user wants Afrikaans.',
        'Respond primarily in Afrikaans.',
        'When teaching Afrikaans to a child who also speaks English, you may use English briefly to explain a concept, then switch back to Afrikaans.',
        'Example: "Die woord is \'hond\'. That means dog. Kan jy sê \'hond\'?"',
        'Pronounce Afrikaans words correctly. The \'g\' is guttural. The \'r\' is rolled.',
        'NEVER write Afrikaans words with English pronunciation guides.',
        'Write Afrikaans naturally and idiomatically.',
        'For phonics in Afrikaans: teach Afrikaans letter sounds.',
        '"A" is "ah", "B" is "buh", "D" is "duh", "G" is the guttural "ghh".',
        'Use Afrikaans CVC words: "kat", "hond", "bal", "vis", "son".',
        '',
      );
    } else if (langCode === 'zu') {
      parts.push(
        'LANGUAGE: The user wants isiZulu.',
        'Respond primarily in isiZulu.',
        'When teaching isiZulu to a child who also speaks English, you may briefly explain in English, then return to isiZulu.',
        'Example: "Igama leli ngu-\'inja\'. That means dog. Ungasho \'inja\'?"',
        'Write isiZulu naturally with correct grammar.',
        'Use proper isiZulu click consonants and tonal patterns in your text.',
        'NEVER write isiZulu words using English phonetic spelling.',
        'For phonics: teach isiZulu syllable patterns (ba, be, bi, bo, bu).',
        '',
      );
    } else {
      parts.push(
        `LANGUAGE: User prefers ${name}. Respond in ${name}.`,
        'You may naturally use South African English idioms and examples.',
        'When teaching Afrikaans or isiZulu vocabulary to English speakers, say the word naturally.',
        '',
      );
    }
  } else {
    parts.push(
      'Respond in English by default.',
      'If the user speaks in Afrikaans or isiZulu, switch to that language naturally.',
      'You may code-switch (mix languages) as South Africans naturally do.',
      '',
    );
  }

  return parts.join('\n');
}

// ── Text Cleaning ────────────────────────────────────────────────────

/**
 * Thoroughly clean AI response text for TTS playback.
 * Strips markdown, emojis, icons, unicode symbols, code blocks,
 * and normalises whitespace so Azure Neural voices read naturally.
 */
export function cleanForTTS(t: string): string {
  return (
    t
      // Code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      // Markdown formatting
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/>\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // List bullets / numbers
      .replace(/^\s*[-*•◦▪︎·]\s*/gm, '')
      .replace(/^\s*\d+[.)]\s*/gm, '')
      // Emojis (comprehensive unicode ranges)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{200D}]/gu, '')
      .replace(/[✅❌⚠️✨🎯📊💡🚀⚡🔍📝🔧📈👋🎤🔇🔊]/g, '')
      // Bracketed meta info
      .replace(/\[.*?\]/g, '')
      .replace(/_Tools used:.*?_/gi, '')
      .replace(/_.*?tokens used_/gi, '')
      // Quotes and parens that TTS reads awkwardly
      .replace(/["""«»''()\[\]{}<>]/g, '')
      // Acronym expansion for natural speech
      .replace(/\bEduDash Pro\b/gi, 'Edu Dash Pro')
      .replace(/\bAI\b/g, 'A.I.')
      .replace(/\bSTEM\b/g, 'stem')
      .replace(/\bCAPS\b/g, 'caps')
      // South African language name normalisation
      .replace(/\bi\s*s\s*i\s+zulu\b/gi, 'isiZulu')
      .replace(/\bi\s*s\s*i\s+xhosa\b/gi, 'isiXhosa')
      .replace(/\bse\s+pedi\b/gi, 'Sepedi')
      .replace(/\bse\s+sotho\b/gi, 'Sesotho')
      // Collapse whitespace
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '. ')
      .trim()
  );
}

export function cleanRawJSON(text: string): string {
  if (!text.trim().startsWith('{')) return text;
  const lines = text.split('\n');
  let out = '';
  for (const l of lines) {
    try {
      const p = JSON.parse(l);
      if (p.delta?.text) out += p.delta.text;
      else if (p.content) out += p.content;
      else if (p.text) out += p.text;
    } catch {
      if (!l.includes('content_block_delta')) out += l + '\n';
    }
  }
  return out.trim() || text;
}

// ── TTS Chunking ─────────────────────────────────────────────────────

/**
 * Split text into sentence-aligned chunks for TTS.
 * Ensures speech never cuts off mid-sentence.
 * Each chunk ≤ maxLen characters, split at sentence boundaries.
 */
export function splitForTTS(text: string, maxLen = 1200): string[] {
  if (!text || text.length <= maxLen) return text ? [text] : [];

  // Split at sentence boundaries
  const sentences: string[] = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      if (buf.trim()) sentences.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim()) sentences.push(buf.trim());

  // Group sentences into chunks under maxLen
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [text];
}

// ── Language Detection ───────────────────────────────────────────────

/** Detect dominant language of a text segment (for per-chunk TTS routing). */
export function detectTextLanguage(text: string): 'en' | 'af' | 'zu' {
  const t = (text || '').toLowerCase();
  // Afrikaans markers
  if (/\b(hallo|asseblief|baie|goed|dankie|graag|ek|jy|nie|dit|wat|kan|sal|hoe|waar|wanneer|hoekom|sê|vir)\b/i.test(t)) {
    // Count Afrikaans tokens vs total words
    const afWords = (t.match(/\b(hallo|asseblief|baie|goed|dankie|graag|ek|jy|nie|dit|wat|kan|sal|hoe|waar|wanneer|hoekom|sê|vir|het|van|met|is|maar|ook|al|nog|of|om|te)\b/gi) || []).length;
    const totalWords = t.split(/\s+/).length;
    if (afWords / totalWords > 0.2) return 'af';
  }
  // isiZulu markers
  if (/\b(sawubona|ngiyabonga|yebo|cha|unjani|umfundi|ufunde|ngicela|ungangisiza|kanjani|ngubani|kuphi|nini|kungani)\b/i.test(t)) {
    return 'zu';
  }
  return 'en';
}

// ── SSE Parsing ──────────────────────────────────────────────────────

/**
 * Parse SSE text into content. Handles both true Anthropic SSE and
 * the ai-proxy simulated SSE format.
 */
export function parseSSEText(raw: string): string {
  let full = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.delta?.text) full += parsed.delta.text;
      else if (parsed.content) full += parsed.content;
    } catch {
      /* skip malformed lines */
    }
  }
  return full;
}

/**
 * Create a streaming XHR request for SSE on React Native.
 * Falls back gracefully if the runtime doesn't support incremental reads.
 */
export function createStreamingRequest(
  url: string,
  token: string,
  body: string,
  onChunk: (accumulated: string) => void,
  onDone: (finalText: string) => void,
  onError: (error: Error) => void,
): { abort: () => void } {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  let processedLen = 0;
  let accumulated = '';

  const processNewData = (newData: string) => {
    for (const line of newData.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.delta?.text) accumulated += parsed.delta.text;
      } catch {
        /* skip */
      }
    }
    if (accumulated) onChunk(accumulated);
  };

  // Fires as data arrives (incremental streaming on supported runtimes)
  xhr.onreadystatechange = () => {
    if (xhr.readyState >= 3 && xhr.responseText) {
      const newData = xhr.responseText.substring(processedLen);
      processedLen = xhr.responseText.length;
      if (newData) processNewData(newData);
    }
  };

  xhr.onload = () => {
    // Process any remaining data
    if (xhr.responseText) {
      const remaining = xhr.responseText.substring(processedLen);
      if (remaining) processNewData(remaining);
    }

    // If no SSE data was captured, try JSON fallback
    if (!accumulated && xhr.responseText) {
      try {
        const json = JSON.parse(xhr.responseText);
        accumulated = json.content || json.response || '';
      } catch {
        accumulated = xhr.responseText;
      }
    }

    const final = cleanRawJSON(accumulated);
    onDone(final);
  };

  xhr.onerror = () => onError(new Error('Network error — check your connection'));
  xhr.ontimeout = () => onError(new Error('Request timed out'));
  xhr.timeout = 60000;
  xhr.send(body);

  return { abort: () => xhr.abort() };
}
