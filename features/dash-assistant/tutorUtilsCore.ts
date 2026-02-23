import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type {
  TutorMode,
  TutorPayload,
  TutorSession,
  PreschoolPlayType,
  PhonicsStage,
} from '@/hooks/dash-assistant/tutorTypes';
import { getMascotPersonality } from '@/lib/dash-ai/tutorTheme';
import { getTutorChallengePlan } from './tutorChallengePolicy';

const PHONICS_STAGE_ORDER: PhonicsStage[] = ['letter_sounds', 'cvc_blending', 'rhyming', 'segmenting'];

const PHONICS_TRIGGER_PATTERN = /\b(phonics|letter sounds?|teach me letter|what sound does|blend(?:ing)?|segment(?:ing)?|rhyme(?:s|ing)?|short vowel|long vowel)\b/i;

export const detectTutorIntent = (text: string): TutorMode | null => {
  const value = (text || '').toLowerCase();
  if (!value) return null;

  // Play mode — preschool interactive play (check BEFORE other modes)
  if (/(let.s\s+play|play\s+a\s+game|play\s+with\s+me|fun\s+game|counting\s+game|colour\s+game|shape\s+game|rhyme\s+game|story\s+time|animal\s+sound|letter\s+game|silly\s+question)/i.test(value)) return 'play';
  // Phonics mode defaults to guided practice flow
  if (PHONICS_TRIGGER_PATTERN.test(value)) return 'practice';
  // Quiz mode — formal assessment-style
  if (/(quiz\s+me|test\s+me|give\s+me\s+a\s+quiz|assessment|mock\s+test|exam\s+prep|past\s+paper)/i.test(value)) return 'quiz';
  // Practice mode — exercises, drills, worksheets
  if (/(practice\s+question|drill\s+me|give\s+me\s+practice|worksheet|exercise|let.s\s+practice|homework\s+practice)/i.test(value)) return 'practice';
  // Diagnostic mode — level assessment
  if (/(diagnose\s+me|diagnostic\s+test|check\s+my\s+level|assess\s+me|what\s+grade\s+am\s+i)/i.test(value)) return 'diagnostic';
  // Explain mode — teaching, homework help
  if (/(explain|help\s+me\s+understand|teach\s+me|how\s+does|what\s+is|homework\s+help|can\s+you\s+explain)/i.test(value)) return 'explain';

  return null;
};

export const detectPhonicsTutorRequest = (text: string): boolean => {
  return PHONICS_TRIGGER_PATTERN.test(text || '');
};

export const getInitialPhonicsStage = (text: string): PhonicsStage => {
  const value = (text || '').toLowerCase();
  if (/\bsegment(?:ing)?\b/.test(value)) return 'segmenting';
  if (/\brhyme(?:s|ing)?\b/.test(value)) return 'rhyming';
  if (/\bblend(?:ing)?\b|\bc-a-t\b/.test(value)) return 'cvc_blending';
  return 'letter_sounds';
};

export const nextPhonicsStage = (current?: PhonicsStage | null): PhonicsStage => {
  const stage = current || 'letter_sounds';
  const idx = PHONICS_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= PHONICS_STAGE_ORDER.length - 1) {
    return PHONICS_STAGE_ORDER[PHONICS_STAGE_ORDER.length - 1];
  }
  return PHONICS_STAGE_ORDER[idx + 1];
};

/** Detect which preschool play sub-type the user wants */
export const detectPlayType = (text: string): PreschoolPlayType | null => {
  const v = (text || '').toLowerCase();
  if (/(count|number|how many)/i.test(v)) return 'counting_game';
  if (/(colour|color|rainbow)/i.test(v)) return 'colour_quiz';
  if (/(shape|circle|square|triangle)/i.test(v)) return 'shape_hunt';
  if (/(rhyme|rhyming|poem|song)/i.test(v)) return 'rhyme_time';
  if (/(story|tale|once upon|adventure)/i.test(v)) return 'story_time';
  if (/(animal|sound|moo|woof|meow)/i.test(v)) return 'animal_sounds';
  if (/(letter|abc|alphabet|phonics)/i.test(v)) return 'letter_fun';
  if (/(silly|funny|joke|giggle)/i.test(v)) return 'silly_questions';
  return null;
};

export const isTutorStopIntent = (text: string) => {
  return /(stop|end\s+session|exit\s+tutor|cancel\s+quiz|new\s+topic)/i.test(text || '');
};

export const getMaxQuestions = (
  mode: TutorMode,
  learnerContext?: LearnerContext | null,
  options?: { difficulty?: number | null; phonicsMode?: boolean },
) => {
  return getTutorChallengePlan({
    mode,
    learnerContext,
    difficulty: options?.difficulty,
    phonicsMode: options?.phonicsMode,
  }).maxQuestions;
};

export const getTutorPhaseLabel = (mode: TutorMode) => {
  switch (mode) {
    case 'explain':
      return 'Teach';
    case 'practice':
    case 'quiz':
      return 'Practice';
    case 'play':
      return 'Play';
    case 'diagnostic':
    default:
      return 'Diagnose';
  }
};

export const extractLearningContext = (text: string, fallback?: LearnerContext | null) => {
  const value = (text || '').toLowerCase();
  const gradeMatch = value.match(/grade\s*(r|[0-9]{1,2})/i);
  const grade = gradeMatch
    ? gradeMatch[1].toUpperCase()
    : (fallback?.grade ? String(fallback.grade).toUpperCase() : null);
  const subjectMap: Array<{ key: RegExp; label: string }> = [
    { key: /math|mathematics|algebra|geometry|numbers/, label: 'Mathematics' },
    { key: /science|physics|chemistry|biology/, label: 'Science' },
    { key: /english|reading|writing|language/, label: 'English' },
    { key: /history|social\s+studies|geography/, label: 'Social Sciences' },
    { key: /life\s+skills|life\s+orientation/, label: 'Life Skills' },
  ];
  const subject = subjectMap.find(entry => entry.key.test(value))?.label || null;
  const topicMatch = value.match(/(?:topic|on|about)\s+([a-z0-9\s-]{3,})/i);
  const topic = topicMatch ? topicMatch[1].trim() : null;
  return {
    grade,
    subject,
    topic,
    ageBand: fallback?.ageBand || null,
    ageYears: fallback?.ageYears || null,
    schoolType: fallback?.schoolType || null,
    learnerName: fallback?.learnerName || null,
  };
};

export const buildTutorSystemContext = (
  session: TutorSession,
  options: {
    phase: 'start' | 'evaluate';
    learnerContext?: LearnerContext | null;
    tutorEntrySource?: 'teacher_dashboard' | 'default';
  }
) => {
  const learner = options.learnerContext;
  const normalizedSchool = (learner?.schoolType || '').toLowerCase();
  const ageBand = learner?.ageBand || null;
  const isPreschool = normalizedSchool.includes('preschool') ||
    normalizedSchool.includes('ecd') ||
    normalizedSchool.includes('early') ||
    ageBand === '3-5' ||
    ageBand === '6-8';
  const isPlayMode = session.mode === 'play';
  const phonicsMode = session.phonicsMode === true;
  const phonicsStage = session.phonicsStage || 'letter_sounds';
  const isTeacherDashboardTutor = options.tutorEntrySource === 'teacher_dashboard';
  const challengePlan = getTutorChallengePlan({
    mode: session.mode,
    learnerContext: learner,
    difficulty: session.difficulty,
    phonicsMode,
  });

  const levelGuidance = isPlayMode
    ? [
        'PRESCHOOL PLAY MODE (3-5 YEAR OLDS):',
        '- You are a warm, playful, patient AI friend called Dash.',
        '- Speak like a fun teacher talking to a 3-5 year old child.',
        '- Use VERY short sentences (5-10 words max).',
        '- Use lots of emojis to make it visual and fun.',
        '- Keep everything 100% play-based — NO formal testing language.',
        '- Celebrate EVERY attempt, even wrong ones: "Great try! Let\'s look again!"',
        '- Use silly sounds, animal noises, and countdown language.',
        '- Ask ONE question at a time and wait.',
        '- Topics: counting 1-10, colours, shapes, letters/sounds, animals, rhyming, stories.',
        '- For counting: show emoji objects and ask "How many?"',
        '- For colours: "What colour is a banana? 🍌"',
        '- For shapes: "A wheel is round like a... ⭕"',
        '- For letters: "Apple starts with which letter? Aaa-pple 🍎"',
        '- For rhyming: "Which word sounds like CAT? Hat or Dog?"',
        '- For stories: "Once upon a time... what happened next?"',
        '- After 3 correct in a row, make it slightly harder.',
        '- After 2 wrong in a row, make it easier and give the answer.',
        '- Include a physical mini-challenge every 3rd round: "Jump like a frog! 🐸"',
        '- End with a celebration: "You\'re a SUPERSTAR! ⭐⭐⭐"',
        session.playType ? `- Play focus: ${session.playType.replace(/_/g, ' ')}` : '',
      ].filter(Boolean).join('\n')
    : isPreschool
    ? [
        'PRESCHOOL MODE:',
        '- Use very simple language and short sentences.',
        '- Focus on play-based learning, colors, shapes, counting to 10, letters/sounds, and everyday objects.',
        '- Keep questions extremely short and concrete.',
        '- Avoid K-12 framing or advanced concepts.',
        '- Praise effort and keep tone warm and playful.',
        '- Use fun comparisons: "How many apples? 🍎🍎🍎"',
      ].join('\n')
    : [
        'K-12 MODE (CAPS-ALIGNED):',
        '- Follow the South African CAPS (Curriculum Assessment Policy Statements) curriculum.',
        '- Match content to the specific grade level and CAPS learning outcomes.',
        '- Use CAPS terminology: Learning Outcome, Assessment Standard, Content Area.',
        '- Reference SA-specific content (Rand currency, SA geography, local examples).',
        '- Use clear step-by-step explanations with numbered points.',
        '- Break complex topics into simple, digestible parts.',
        '- Provide concrete examples to illustrate concepts.',
        '- Use bullet points and structured formatting for clarity.',
        '- When explaining, follow this structure:',
        '  1. Simple introduction (connect to prior knowledge)',
        '  2. Key concepts with real-world examples',
        '  3. Step-by-step breakdown with worked examples',
        '  4. One diagnostic question to check understanding',
        '- Keep each section concise but comprehensive.',
        '',
        'CAPS SUBJECT FRAMEWORKS:',
        '- Mathematics: Follow CAPS content areas (Numbers, Patterns, Space & Shape, Measurement, Data)',
        '- English: Follow CAPS skills (Listening, Speaking, Reading, Writing, Language)',
        '- Science: Follow CAPS strands (Life & Living, Energy & Change, Matter & Materials, Earth & Beyond)',
        '- Social Sciences: Geography (SA provinces, climate) + History (SA heritage, key events)',
        '- Life Skills: Personal & Social Wellbeing, Physical Education, Creative Arts',
      ].join('\n');

  const phonicsGuidance = phonicsMode
    ? [
        'PHONICS PROGRESSION MODE:',
        `- Current stage: ${phonicsStage.replace(/_/g, ' ')}.`,
        `- Run about ${challengePlan.spellingChallenges} short sound/spelling rounds before switching topics.`,
        '- Use sounds, not letter names.',
        '- CRITICAL: Wrap ALL letter sounds in slash markers: /s/, /m/, /f/, /b/, /a/, etc.',
        '- Example: "This letter makes the sound /s/. Can you hiss like a snake? /s/!"',
        '- NEVER write bare sustained text like "sss", "mmm", "fff" — always /s/, /m/, /f/.',
        '- Model sound-first blending: "/k/ - /a/ - /t/ ... cat".',
        '- Ask ONE phonics prompt at a time and wait for the learner answer.',
        '- Keep examples playful and concrete with 3-5 year old vocabulary.',
      ].join('\n')
    : null;
  const slowLearnerGuidance = session.slowLearner
    ? [
        'SLOW LEARNER SUPPORT MODE (PARENT-ENFORCED):',
        '- Keep pacing deliberately slower and confidence-building.',
        '- Teach one concept at a time and ask one question at a time.',
        '- Use simple wording and short instructions (2-4 lines each).',
        '- If incorrect: give one hint, then a worked example, then retry.',
        '- Confirm understanding with a short confidence check before moving on.',
        '- Use supportive language; frame mistakes as retries, never penalties.',
      ].join('\n')
    : null;

  const mascotPersonality = getMascotPersonality(ageBand);

  const baseLines = [
    'TUTOR MODE OVERRIDE:',
    `Mode: ${session.mode}.`,
    `Difficulty target: ${session.difficulty || 1}/3.`,
    `Personality: ${mascotPersonality}.`,
    learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
    learner?.grade ? `Grade: ${learner.grade}.` : session.grade ? `Grade: ${session.grade}.` : null,
    session.subject ? `Subject: ${session.subject}.` : null,
    session.topic ? `Topic: ${session.topic}.` : null,
    ageBand ? `Age band: ${ageBand}.` : null,
    learner?.schoolType ? `School type: ${learner.schoolType}.` : null,
    levelGuidance,
    phonicsGuidance,
    slowLearnerGuidance,
    '',
    'CAPS CURRICULUM TOOLS (for K-12 learners):',
    '- You can search the CAPS curriculum database using the search_caps_curriculum tool.',
    '- Use it when generating grade-specific questions to ensure alignment with official CAPS content.',
    '- Include CAPS content area references in your questions where relevant.',
    '- Example: For Grade 4 Mathematics on fractions, search "fractions Grade 4" to get official CAPS outcomes.',
    '',
    'INTERACTIVE TEACHING TOOLS:',
    '- For math: Show visual representations (use emoji grids for counting, simple ASCII diagrams for shapes)',
    '- For reading: Highlight key vocabulary with **bold** and explain in context',
    '- For science: Use cause-and-effect chains and simple diagrams',
    '- If you include a diagram, output an actual renderable block (Mermaid/ASCII), never [DIAGRAM] placeholders.',
    '- If you include a chart, provide a markdown table or chart-ready labels/values (never [CHART]/[GRAPH]).',
    '- For column-method arithmetic, emit a fenced `column` JSON block with addends for interactive rendering.',
    '- For spelling drills, emit a fenced `spelling` JSON block with target word + hint for interactive practice.',
    `- Target around ${challengePlan.spellingChallenges} spelling challenge(s) this session, then recap weak letters/sounds.`,
    '- Use progress encouragement: "Great work! You got 3/5 correct so far!"',
    '- Adapt difficulty dynamically: if 2+ wrong in a row, simplify; if 3+ right, increase challenge',
    '- When the learner is stuck, offer multiple scaffolding strategies:',
    '  1. Visual hint (diagram, emoji representation)',
    '  2. Worked example of a similar problem',
    '  3. Break into micro-steps',
    '  4. Real-world analogy',
    '',
    'DIAGNOSE → TEACH → PRACTICE → CHECK FLOW:',
    '- Follow this pedagogical cycle for every topic:',
    `  DIAGNOSE: Ask ${challengePlan.diagnosticQuestions} short diagnostic question(s) to assess current understanding.`,
    '  TEACH: Based on gaps found, explain the concept with worked examples and CAPS alignment.',
    `  PRACTICE: Present around ${challengePlan.practiceQuestions} practice question(s) one at a time using structured quiz format (see below).`,
    `  CHECK: Ask ${challengePlan.synthesisQuestions} synthesis question(s), then summarize and celebrate progress.`,
    '- Transition between phases naturally — don\'t announce phase names to the student.',
    '- Always start with DIAGNOSE unless the student explicitly asks "just explain" or "just quiz me".',
    '',
    'STRUCTURED QUIZ OUTPUT (for PRACTICE and CHECK phases):',
    '- When presenting quiz/practice questions, include a structured JSON block',
    '  so the UI can render interactive quiz cards with tap-to-answer:',
    '```quiz',
    '{"type":"quiz_question","question":"What is 3 × 4?","options":["9","12","15","7"],"correct":"12","explanation":"3 × 4 = 12 because multiplication means adding 3 four times: 3+3+3+3=12","difficulty":"easy","subject":"Mathematics","topic":"Multiplication","grade":"Grade 3"}',
    '```',
    '- You may include conversational text BEFORE the quiz block (e.g., "Let\'s try this one:").',
    '- For fill-in-the-blank, omit "options" and set "type":"fill_blank".',
    '- For true/false, use "options":["True","False"] and set "type":"true_false".',
    '- Always include "explanation" — it shows after the student answers.',
    '',
    'RESPONSE FORMATTING:',
    '- Be highly interactive: ask ONE short question at a time and wait.',
    '- If the learner is wrong, provide a hint plus a step-by-step scaffold before asking the next question.',
    '- When explaining concepts, use clear headers and numbered steps.',
    '- Break down complex information into sections with headings.',
    '- Use bullet points for lists of related items.',
    '- Provide concrete examples after each key concept.',
    '- For homework help, structure responses as:',
    '  1. "What this is about" - brief overview',
    '  2. Key concepts breakdown with examples',
    '  3. Step-by-step solution or explanation',
    '  4. One check question to verify understanding',
    '',
    'VOICE-OPTIMIZED OUTPUT:',
    '- Write naturally as if speaking to a learner face-to-face.',
    '- Avoid parenthetical pronunciation guides like "(PRON-un-see-AY-shun)".',
    '- NEVER use markdown formatting symbols when in voice mode.',
    '- Use short, conversational sentences.',
    '- Pause between concepts (use periods, not semicolons).',
    '',
    'PRONUNCIATION RULES (CRITICAL — these affect how TTS reads your text):',
    '- "EduDash Pro" is ONE compound brand name — never split it as "Edu Dash Pro".',
    '- South African language names are single words: "isiZulu" (not "isi Zulu"), "isiXhosa" (not "isi Xhosa"), "Sesotho" (not "Se sotho"), "Sepedi" (not "Se pedi").',
    '- When greeting in another language, write the word as-is: "Sawubona!" or "Molo!" or "Dumela!"',
    '- For phonics, ALWAYS use slash markers for sounds: write "/s/" not "sss" or "the letter S".',
    '- For blending, model sounds first: "/k/ - /a/ - /t/ ... cat".',
    '- When switching languages mid-sentence, keep the foreign word intact — do not transliterate or add pronunciation guides in parentheses.',
    '- Common abbreviations: say "caps" (not C-A-P-S), "stem" (not S-T-E-M), "A.I." (spell out).',
    isTeacherDashboardTutor ? 'TEACHER SESSION QUALITY RULES:' : null,
    isTeacherDashboardTutor ? '- Keep responses class-ready and CAPS-aligned for teacher facilitation.' : null,
    isTeacherDashboardTutor ? '- Prefer clear sections when explaining: CAPS objective, lesson flow, materials/media, and parent follow-up task.' : null,
    isTeacherDashboardTutor ? '- Avoid generic filler; provide specific examples, timings, and practical classroom steps.' : null,
    '',
    'Ask ONE question only and stop. Do not add extra questions or commentary.',
    'Keep responses very short (2-4 short lines max) unless explaining a concept.',
    'If the learner shared an attachment, assume it contains the question — analyse it and respond directly.',
    'If grade or topic is missing AND no attachment was shared, ask a single clarifying question instead.',
    'Return ONLY JSON wrapped in <TUTOR_PAYLOAD> tags.',
  ];

  if (options.phase === 'evaluate') {
    baseLines.push(
      `Question: ${session.currentQuestion || 'N/A'}`,
      session.expectedAnswer ? `Expected answer: ${session.expectedAnswer}` : null,
      "Evaluate the learner's latest message as the answer.",
      'Be strict and factual: only mark correct when the answer clearly matches.',
      'If unsure, mark incorrect and explain why.',
      'If incorrect, provide a gentle hint, show a short step-by-step scaffold, then ask ONE follow-up question.'
    );
    baseLines.push(
      'JSON keys: is_correct, score (0-100), feedback, correct_answer, explanation, misconception, follow_up_question, next_expected_answer.',
      'Example: <TUTOR_PAYLOAD>{"is_correct":false,"score":40,"feedback":"...","correct_answer":"...","explanation":"...","misconception":"...","follow_up_question":"...","next_expected_answer":"..."}</TUTOR_PAYLOAD>'
    );
  } else {
    baseLines.push(
      'JSON keys: question, expected_answer, subject, grade, topic, difficulty, next_step.',
      'Example: <TUTOR_PAYLOAD>{"question":"...","expected_answer":"...","subject":"...","grade":"...","topic":"...","difficulty":1,"next_step":"answer"}</TUTOR_PAYLOAD>'
    );
  }

  return baseLines.filter(Boolean).join('\n');
};

export const parseTutorPayload = (content: string): TutorPayload | null => {
  if (!content) return null;
  const knownKeys = new Set([
    'question',
    'expected_answer',
    'is_correct',
    'score',
    'feedback',
    'correct_answer',
    'follow_up_question',
    'next_expected_answer',
    'subject',
    'grade',
    'topic',
    'difficulty',
    'steps',
    'hint',
    'explanation',
  ]);

  const sanitizeCandidate = (raw: string) => {
    if (!raw) return '';
    let next = raw.trim();
    next = next
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .replace(/<\/?TUTOR_PAYLOAD>/gi, '')
      .trim();
    const firstBrace = next.indexOf('{');
    const lastBrace = next.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      next = next.slice(firstBrace, lastBrace + 1);
    }
    return next.trim();
  };

  const tryParse = (raw: string): TutorPayload | null => {
    const sanitized = sanitizeCandidate(raw);
    if (!sanitized) return null;
    const candidates = [sanitized, sanitized.replace(/,\s*([}\]])/g, '$1')];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') continue;
        const keys = Object.keys(parsed);
        if (!keys.some((key) => knownKeys.has(key))) continue;
        return parsed as TutorPayload;
      } catch {
        // Continue with next candidate.
      }
    }
    return null;
  };

  const rawCandidates: string[] = [];

  const tagMatch = content.match(/<TUTOR_PAYLOAD>([\s\S]*?)<\/TUTOR_PAYLOAD>/i);
  if (tagMatch?.[1]) rawCandidates.push(tagMatch[1]);

  const codeBlockMatches = content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of codeBlockMatches) {
    if (match?.[1]) rawCandidates.push(match[1]);
  }

  // Balanced-brace extraction catches slightly malformed wrappers around JSON.
  const braceCandidates: string[] = [];
  const stack: number[] = [];
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}' && stack.length > 0) {
      const start = stack.pop() as number;
      if (stack.length === 0) {
        braceCandidates.push(content.slice(start, i + 1));
      }
    }
  }
  rawCandidates.push(...braceCandidates.sort((a, b) => b.length - a.length));
  rawCandidates.push(content);

  const deduped = Array.from(new Set(rawCandidates.map((value) => value.trim()).filter(Boolean)));
  for (const candidate of deduped) {
    const parsed = tryParse(candidate);
    if (parsed) return parsed;
  }
  return null;
};

export const normalizeTutorText = (value: string) => {
  return (value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const splitExpectedAnswers = (expected: string) => {
  return expected
    .split(/\/|,|;|\bor\b|\band\b/i)
    .map(part => part.trim())
    .filter(Boolean);
};

export const extractNumbers = (value: string) => {
  const matches = (value || '').match(/-?\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number).filter(n => !Number.isNaN(n)) : [];
};

export const reconcileTutorEvaluation = (payload: TutorPayload, learnerAnswer: string, session: TutorSession) => {
  if (!payload || typeof payload.is_correct !== 'boolean' || !payload.is_correct) return payload;
  const feedbackText = `${payload.feedback || ''} ${payload.explanation || ''}`.toLowerCase();
  if (/(not\s+quite|incorrect|not correct|try again|almost|needs work)/i.test(feedbackText)) {
    return { ...payload, is_correct: false };
  }

  const expected = String(payload.correct_answer || session.expectedAnswer || '').trim();
  if (!expected) return payload;

  const normalizedAnswer = normalizeTutorText(learnerAnswer);
  if (!normalizedAnswer) {
    return {
      ...payload,
      is_correct: false,
      score: typeof payload.score === 'number' ? Math.min(payload.score, 20) : payload.score,
    };
  }

  const expectedNumbers = extractNumbers(expected);
  const answerNumbers = extractNumbers(learnerAnswer);
  if (expectedNumbers.length > 0 && answerNumbers.length > 0) {
    const numericMatch = expectedNumbers.every(num =>
      answerNumbers.some(answerNum => Math.abs(answerNum - num) < 1e-6)
    );
    if (!numericMatch) {
      return {
        ...payload,
        is_correct: false,
        score: typeof payload.score === 'number' ? Math.min(payload.score, 40) : payload.score,
        follow_up_question: payload.follow_up_question || session.currentQuestion || 'Try that again.',
      };
    }
    return payload;
  }

  const expectedCandidates = splitExpectedAnswers(expected).map(normalizeTutorText).filter(Boolean);
  const normalizedExpected = normalizeTutorText(expected);
  const isShortExpected = normalizedExpected.length <= 24 && normalizedExpected.split(' ').length <= 4;

  const matchesExpected = expectedCandidates.length > 0
    ? expectedCandidates.some(candidate =>
        normalizedAnswer === candidate || normalizedAnswer.includes(candidate) || candidate.includes(normalizedAnswer)
      )
    : normalizedExpected
      ? (normalizedAnswer === normalizedExpected || normalizedAnswer.includes(normalizedExpected) || normalizedExpected.includes(normalizedAnswer))
      : false;

  if (isShortExpected && !matchesExpected) {
    return {
      ...payload,
      is_correct: false,
      score: typeof payload.score === 'number' ? Math.min(payload.score, 40) : payload.score,
      feedback: payload.feedback || "Let's think about this - let's try again.",
      follow_up_question: payload.follow_up_question || session.currentQuestion || 'Try that again.',
    };
  }

  if (typeof payload.score === 'number' && payload.score < 70) {
    return {
      ...payload,
      is_correct: false,
    };
  }

  return payload;
};

const normalizeTutorDisplayBlock = (value: string) => {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9? ]/g, '')
    .trim();
};

const dedupeTutorSections = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const blocks = raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const block of blocks) {
    const key = normalizeTutorDisplayBlock(block);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(block);
  }
  return deduped.join('\n\n');
};

export const buildTutorDisplayContent = (payload: TutorPayload, isQuestionStep: boolean) => {
  if (isQuestionStep) {
    const question = payload.question?.trim();
    if (!question) return null;
    return question;
  }

  const lines: string[] = [];
  const seen = new Set<string>();
  const pushLine = (value?: string | null) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const deduped = dedupeTutorSections(trimmed);
    const normalized = normalizeTutorDisplayBlock(deduped);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    lines.push(deduped);
  };

  const explanation = dedupeTutorSections(payload.explanation || '');
  const steps = dedupeTutorSections(payload.steps || '');
  const feedback = dedupeTutorSections(payload.feedback || '');
  const hint = dedupeTutorSections(payload.hint || '');

  const normalizedFeedback = normalizeTutorDisplayBlock(feedback);
  const normalizedHint = normalizeTutorDisplayBlock(hint);
  const feedbackContainsHint = normalizedHint ? normalizedFeedback.includes(normalizedHint) : false;
  const feedbackContainsHintLabel = /\bhint\b/.test(normalizedFeedback);
  const feedbackContainsSteps = /\bsteps?\b/.test(normalizedFeedback);

  const explanationHasSteps = steps
    ? normalizeTutorDisplayBlock(explanation).includes(normalizeTutorDisplayBlock(steps))
    : false;

  if (typeof payload.is_correct === 'boolean') {
    if (payload.is_correct) {
      pushLine('✅ ' + (feedback || 'Correct!'));
    } else if (feedback) {
      pushLine(feedback.trim());
    }
  } else if (feedback) {
    pushLine(feedback.trim());
  }
  if (!feedbackContainsHint && !feedbackContainsHintLabel) {
    pushLine(hint);
  }
  if (payload.correct_answer) {
    pushLine(`Correct answer: ${payload.correct_answer}`);
  }
  if (steps && !explanationHasSteps && !feedbackContainsSteps) pushLine(steps);
  if (explanation) pushLine(explanation);
  if (payload.follow_up_question) {
    pushLine(`Next question:\n${payload.follow_up_question.trim()}`);
  }
  return lines.filter(Boolean).join('\n\n');
};

export const extractTutorQuestionFromText = (content: string) => {
  const cleaned = (content || '').trim();
  if (!cleaned) return null;
  const lines = cleaned
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.includes('?')) {
      return line;
    }
  }
  const fallback = cleaned.match(/(?:^|\n)([^\n]{0,140}\?)\s*$/);
  if (fallback?.[1]) return fallback[1].trim();
  const keywordMatch = cleaned.match(/(?:^|\n)(?:what|which|how|why|solve|calculate|find|name|explain|define)[^\n]{0,120}$/i);
  return keywordMatch ? keywordMatch[0].trim() : null;
};

export const buildTutorHintPack = (params: {
  question?: string | null;
  subject?: string | null;
  expectedAnswer?: string | null;
  incorrectStreak?: number;
}) => {
  const question = (params.question || '').trim();
  const lower = question.toLowerCase();
  const subject = (params.subject || '').toLowerCase();
  const numbers = extractNumbers(question);
  const numberList = numbers.slice(0, 3).join(', ');
  const isMath = subject.includes('math') ||
    numbers.length > 0 ||
    /(add|sum|plus|subtract|minus|difference|multiply|times|product|divide|quotient|fraction|decimal|percent|ratio|equation)/i.test(lower);
  const isReading = subject.includes('english') ||
    /(define|meaning|vocab|synonym|antonym|main idea|summarize|theme|character|plot|story|infer|explain)/i.test(lower);

  let hint = '';
  let steps = '';
  let followUpQuestion = '';

  if (isMath) {
    const opHint = /add|sum|plus/.test(lower)
      ? 'addition'
      : /subtract|minus|difference/.test(lower)
        ? 'subtraction'
        : /multiply|times|product/.test(lower)
          ? 'multiplication'
          : /divide|quotient|per/.test(lower)
            ? 'division'
            : 'the correct operation';
    hint = numberList
      ? `Hint: the key numbers are ${numberList}.`
      : 'Hint: find the key numbers and what the question is asking.';
    steps = [
      'Steps:',
      '1. Identify what the question is asking.',
      `2. Choose ${opHint}.`,
      '3. Calculate carefully.',
      '4. Check your result.'
    ].join('\n');
    followUpQuestion = numberList
      ? `Step 1: Which operation should we use with ${numberList}?`
      : 'Step 1: Which operation should we use?';
  } else if (isReading) {
    hint = 'Hint: focus on the key word or idea in the question.';
    steps = [
      'Steps:',
      '1. Restate the question in your own words.',
      '2. Find the key term or idea.',
      '3. Give a short explanation or example.'
    ].join('\n');
    followUpQuestion = 'Step 1: What is the key word or idea in the question?';
  } else {
    hint = 'Hint: use the exact keywords from your question to decide the method.';
    steps = [
      'Try this:',
      '1. Highlight the exact words that tell you what to do.',
      '2. Name the topic/rule needed for those words.',
      '3. Solve one part using that rule, then complete the full answer.',
      '4. Compare your final answer to the original question wording.'
    ].join('\n');
    followUpQuestion = 'Which keyword in your question tells you the first step?';
  }

  if (params.incorrectStreak && params.incorrectStreak >= 2) {
    hint = hint ? `Let's slow down. ${hint}` : "Let's slow down and take it step by step.";
    if (params.expectedAnswer && params.expectedAnswer.length <= 12 && !hint.includes(params.expectedAnswer)) {
      hint = `${hint} The target answer is ${params.expectedAnswer}.`;
    }
  }

  if (followUpQuestion && !followUpQuestion.trim().endsWith('?')) {
    followUpQuestion = `${followUpQuestion.trim()}?`;
  }

  return { hint, steps, followUpQuestion };
};

const extractFallbackTutorGuidance = (content?: string | null) => {
  const text = String(content || '')
    .replace(/<\/?TUTOR_PAYLOAD>/gi, ' ')
    .replace(/```(?:json)?/gi, ' ')
    .replace(/```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return {
      feedback: '',
      explanation: '',
      followUpQuestion: null as string | null,
    };
  }

  const sentences = (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const followUpQuestion = sentences.find((sentence) => sentence.includes('?')) || null;
  const explanation = sentences
    .filter((sentence) => sentence !== followUpQuestion)
    .slice(0, 2)
    .join(' ')
    .trim();

  return {
    feedback: sentences[0] || '',
    explanation,
    followUpQuestion,
  };
};

export const buildFallbackTutorEvaluation = (
  session: TutorSession,
  learnerAnswer: string,
  modelResponseText?: string | null
): TutorPayload => {
  const expected = String(session.expectedAnswer || '').trim();
  const normalizedAnswer = normalizeTutorText(learnerAnswer || '');
  const guidance = extractFallbackTutorGuidance(modelResponseText);
  let isCorrect = false;

  if (expected && normalizedAnswer) {
    const expectedNumbers = extractNumbers(expected);
    const answerNumbers = extractNumbers(learnerAnswer);
    if (expectedNumbers.length > 0 && answerNumbers.length > 0) {
      isCorrect = expectedNumbers.every(num =>
        answerNumbers.some(answerNum => Math.abs(answerNum - num) < 1e-6)
      );
    } else {
      const expectedCandidates = splitExpectedAnswers(expected).map(normalizeTutorText).filter(Boolean);
      const normalizedExpected = normalizeTutorText(expected);
      isCorrect = expectedCandidates.length > 0
        ? expectedCandidates.some(candidate =>
            normalizedAnswer === candidate || normalizedAnswer.includes(candidate) || candidate.includes(normalizedAnswer)
          )
        : normalizedExpected
          ? (normalizedAnswer === normalizedExpected || normalizedAnswer.includes(normalizedExpected) || normalizedExpected.includes(normalizedAnswer))
          : false;
    }
  }

  return {
    is_correct: isCorrect,
    score: isCorrect ? 100 : 30,
    feedback: isCorrect
      ? (guidance.feedback || 'Correct.')
      : (guidance.feedback || "Let's think about this."),
    explanation: !isCorrect ? (guidance.explanation || undefined) : undefined,
    correct_answer: expected || undefined,
    follow_up_question: !isCorrect ? guidance.followUpQuestion || undefined : undefined,
    subject: session.subject || undefined,
    grade: session.grade || undefined,
    topic: session.topic || undefined,
  };
};

const isGenericTutorText = (value?: string | null) => {
  const normalized = normalizeTutorText(value || '');
  if (!normalized) return true;
  if (normalized.length < 24) return true;
  return /lets think about this|try again|work it out together|calculate carefully|identify what the question/.test(normalized);
};

export const applyTutorHints = (payload: TutorPayload, params: {
  session?: TutorSession | null;
  incorrectStreak: number;
}) => {
  if (payload.is_correct !== false) return payload;
  const session = params.session;
  const question = payload.follow_up_question || payload.question || session?.currentQuestion || '';
  const expectedAnswer = payload.correct_answer || session?.expectedAnswer || payload.expected_answer || null;
  const hintPack = buildTutorHintPack({
    question,
    subject: payload.subject || session?.subject || null,
    expectedAnswer,
    incorrectStreak: params.incorrectStreak,
  });

  const feedback = isGenericTutorText(payload.feedback)
    ? (hintPack.hint || payload.feedback || "Let's think about this - let's work it out together.")
    : (payload.feedback || "Let's think about this - let's work it out together.");

  let explanation = dedupeTutorSections(payload.explanation || '');
  const hasStructuredGuidance = !!(payload.steps || explanation);
  if (!hasStructuredGuidance && hintPack.steps) {
    explanation = hintPack.steps;
  }

  let followUpQuestion = payload.follow_up_question || hintPack.followUpQuestion || session?.currentQuestion || null;
  if (followUpQuestion && !followUpQuestion.trim().endsWith('?')) {
    followUpQuestion = `${followUpQuestion.trim()}?`;
  }

  let correctAnswer = payload.correct_answer;
  if (!correctAnswer && expectedAnswer && params.incorrectStreak >= 2) {
    correctAnswer = expectedAnswer;
  }

  return {
    ...payload,
    feedback,
    explanation,
    follow_up_question: followUpQuestion || payload.follow_up_question,
    correct_answer: correctAnswer,
    hint: payload.hint || (isGenericTutorText(payload.feedback) ? hintPack.hint : undefined),
    steps: payload.steps || (explanation ? undefined : hintPack.steps),
  };
};
