import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type { TutorMode, TutorPayload, TutorSession } from '@/hooks/dash-assistant/tutorTypes';

export const detectTutorIntent = (text: string): TutorMode | null => {
  const value = (text || '').toLowerCase();
  if (!value) return null;

  if (/(quiz\s+me|test\s+me|give\s+me\s+a\s+quiz|assessment|mock\s+test)/.test(value)) return 'quiz';
  if (/(practice\s+question|drill\s+me|give\s+me\s+practice|worksheet\s+questions)/.test(value)) return 'practice';
  if (/diagnose\s+me|diagnostic\s+test/.test(value)) return 'diagnostic';

  return null;
};

export const isTutorStopIntent = (text: string) => {
  return /(stop|end\s+session|exit\s+tutor|cancel\s+quiz|new\s+topic)/i.test(text || '');
};

export const getMaxQuestions = (mode: TutorMode) => {
  switch (mode) {
    case 'diagnostic':
    case 'quiz':
      return 5;
    case 'practice':
      return 3;
    case 'explain':
    default:
      return 1;
  }
};

export const getTutorPhaseLabel = (mode: TutorMode) => {
  switch (mode) {
    case 'explain':
      return 'Teach';
    case 'practice':
    case 'quiz':
      return 'Practice';
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

  const levelGuidance = isPreschool
    ? [
        'PRESCHOOL MODE:',
        '- Use very simple language and short sentences.',
        '- Focus on play-based learning, colors, shapes, counting to 10, letters/sounds, and everyday objects.',
        '- Keep questions extremely short and concrete.',
        '- Avoid K-12 framing or advanced concepts.',
        '- Praise effort and keep tone warm and playful.',
      ].join('\n')
    : [
        'K-12 MODE:',
        '- Match the learner grade and keep the difficulty age-appropriate.',
        '- Use clear step-by-step explanations with numbered points.',
        '- Break complex topics into simple, digestible parts.',
        '- Provide concrete examples to illustrate concepts.',
        '- Use bullet points and structured formatting for clarity.',
        '- When explaining, follow this structure:',
        '  1. Simple introduction',
        '  2. Key concepts with examples',
        '  3. Step-by-step breakdown',
        '  4. One diagnostic question to check understanding',
        '- Keep each section concise but comprehensive.',
      ].join('\n');

  const baseLines = [
    'TUTOR MODE OVERRIDE:',
    `Mode: ${session.mode}.`,
    `Difficulty target: ${session.difficulty || 1}/3.`,
    learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
    learner?.grade ? `Grade: ${learner.grade}.` : session.grade ? `Grade: ${session.grade}.` : null,
    session.subject ? `Subject: ${session.subject}.` : null,
    session.topic ? `Topic: ${session.topic}.` : null,
    ageBand ? `Age band: ${ageBand}.` : null,
    learner?.schoolType ? `School type: ${learner.schoolType}.` : null,
    levelGuidance,
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
    'Ask ONE question only and stop. Do not add extra questions or commentary.',
    'Keep responses very short (2-4 short lines max) unless explaining a concept.',
    'If grade or topic is missing, ask a single clarifying question instead.',
    'If the learner shared an attachment, assume it contains the question and ask about it directly.',
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
  const tagMatch = content.match(/<TUTOR_PAYLOAD>([\s\S]*?)<\/TUTOR_PAYLOAD>/i);
  const jsonCandidate = tagMatch ? tagMatch[1] : null;
  const fallbackMatch = !jsonCandidate ? content.match(/\{[\s\S]*\}/) : null;
  const raw = (jsonCandidate || fallbackMatch?.[0] || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TutorPayload;
  } catch {
    return null;
  }
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

export const buildTutorDisplayContent = (payload: TutorPayload, isQuestionStep: boolean) => {
  if (isQuestionStep) {
    const question = payload.question?.trim();
    if (!question) return null;
    return question;
  }

  const lines: string[] = [];
  if (typeof payload.is_correct === 'boolean') {
    if (payload.is_correct) {
      lines.push('✅ ' + (payload.feedback || 'Correct!'));
    } else if (payload.feedback) {
      lines.push(payload.feedback.trim());
    }
  } else if (payload.feedback) {
    lines.push(payload.feedback.trim());
  }
  if (payload.hint) lines.push(payload.hint.trim());
  if (payload.correct_answer) {
    lines.push(`Correct answer: ${payload.correct_answer}`);
  }
  if (payload.steps) lines.push(payload.steps.trim());
  if (payload.explanation) lines.push(payload.explanation.trim());
  if (payload.follow_up_question) {
    lines.push(`\nNext question:\n${payload.follow_up_question.trim()}`);
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
    hint = 'Hint: start by identifying what the question is asking you to do.';
    steps = [
      'Steps:',
      '1. Identify the goal of the question.',
      '2. List the important information.',
      '3. Apply the rule or concept.',
      '4. Check your answer.'
    ].join('\n');
    followUpQuestion = 'Step 1: What is the question asking you to find or explain?';
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

export const buildFallbackTutorEvaluation = (session: TutorSession, learnerAnswer: string): TutorPayload => {
  const expected = String(session.expectedAnswer || '').trim();
  const normalizedAnswer = normalizeTutorText(learnerAnswer || '');
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
    feedback: isCorrect ? 'Correct.' : "Let's think about this.",
    correct_answer: expected || undefined,
    follow_up_question: undefined,
    subject: session.subject || undefined,
    grade: session.grade || undefined,
    topic: session.topic || undefined,
  };
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

  const feedback = payload.feedback || "Let's think about this - let's work it out together.";

  let explanation = payload.explanation || '';
  if (hintPack.steps && !explanation.includes(hintPack.steps)) {
    explanation = explanation ? `${explanation}\n${hintPack.steps}` : hintPack.steps;
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
    hint: payload.hint || hintPack.hint,
    steps: payload.steps || hintPack.steps,
  };
};
