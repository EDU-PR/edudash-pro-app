/**
 * useTutorPipeline Hook
 *
 * Enforces the Diagnose → Teach → Practice → Check pedagogical state machine.
 * Each phase injects phase-specific system prompt overrides and tracks criteria
 * for automatic advancement.
 *
 * Extracted as a standalone hook for WARP.md compliance (≤200 lines).
 */

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { getTutorChallengePlan } from './tutorChallengePolicy';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TutorPhase = 'IDLE' | 'DIAGNOSE' | 'TEACH' | 'PRACTICE' | 'CHECK' | 'COMPLETE';

export interface TutorPipelineConfig {
  subject: string;
  grade: string;
  topic: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  language?: string;
}

export interface PhaseCriteria {
  /** Number of diagnostic questions asked in DIAGNOSE */
  diagnosticQuestionsAsked: number;
  /** Whether a core concept was explained in TEACH */
  conceptExplained: boolean;
  /** Total practice questions answered in PRACTICE */
  practiceAnswered: number;
  /** Correct practice answers in PRACTICE */
  practiceCorrect: number;
  /** Whether comprehension check passed in CHECK */
  checkPassed: boolean;
}

export interface PipelineSessionSummary {
  phases: TutorPhase[];
  config: TutorPipelineConfig;
  criteria: PhaseCriteria;
  startedAt: string;
  completedAt: string | null;
  masteryAchieved: boolean;
}

export interface UseTutorPipelineReturn {
  currentPhase: TutorPhase;
  config: TutorPipelineConfig | null;
  criteria: PhaseCriteria;
  phasePromptOverride: string;
  sessionSummary: PipelineSessionSummary | null;
  startPipeline: (config: TutorPipelineConfig) => void;
  advancePhase: () => void;
  recordDiagnosticQuestion: () => void;
  recordConceptExplained: () => void;
  recordPracticeAnswer: (correct: boolean) => void;
  recordCheckResult: (passed: boolean) => void;
  resetPipeline: () => void;
}

// ─── Phase prompt injections ─────────────────────────────────────────────────
const pluralize = (count: number, singular: string, plural?: string) => (
  `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`
);

const PHASE_PROMPTS: Record<Exclude<TutorPhase, 'IDLE'>, (cfg: TutorPipelineConfig) => string> = {
  DIAGNOSE: (cfg) => {
    const plan = getTutorChallengePlan({
      mode: 'diagnostic',
      learnerContext: { grade: cfg.grade },
      difficulty: cfg.difficulty,
    });
    return `
[TUTOR PHASE: DIAGNOSE]
You are assessing the student's current knowledge of ${cfg.topic} (${cfg.subject}, ${cfg.grade}).
- Ask ${pluralize(plan.diagnosticQuestions, 'SHORT diagnostic question')} — each one DIFFERENT. Never repeat the same question.
- Vary question types: recall, application, and one slightly harder.
- Do NOT teach yet — only assess. Keep it conversational.
- After each answer, acknowledge briefly and ask a DIFFERENT question.
- CRITICAL: After ${plan.diagnosticQuestions} diagnostic questions, advance. Do NOT get stuck repeating prompts.
- When ready, say: "Great, I have a good picture of where you are!"`;
  },

  TEACH: (cfg) => `
[TUTOR PHASE: TEACH]
Based on the diagnostic results, teach ${cfg.topic} (${cfg.subject}, ${cfg.grade}).
- Address specific gaps identified in diagnosis.
- Use clear examples, analogies, and visual descriptions.
- Break complex concepts into bite-sized chunks (2-3 sentences per idea).
- Use South African curriculum (CAPS) examples where relevant.
- Include one worked example showing the full solution process.
- End with: "Ready to try some practice?" to transition.`,

  PRACTICE: (cfg) => {
    const plan = getTutorChallengePlan({
      mode: 'practice',
      learnerContext: { grade: cfg.grade },
      difficulty: cfg.difficulty,
    });
    return `
[TUTOR PHASE: PRACTICE]
Give the student practice problems on ${cfg.topic} (${cfg.subject}, ${cfg.grade}).
- Present ONE question at a time and WAIT for their answer.
- When presenting a question, output it as a structured JSON block:
\`\`\`quiz
{"type":"quiz_question","question":"...","options":["A","B","C","D"],"correct":"B","explanation":"...","difficulty":"${cfg.difficulty <= 2 ? 'easy' : cfg.difficulty <= 4 ? 'medium' : 'hard'}","subject":"${cfg.subject}","topic":"${cfg.topic}","grade":"${cfg.grade}"}
\`\`\`
- After they answer, give immediate feedback (correct/incorrect + brief explanation).
- If incorrect, explain the misconception and offer a hint before the next question.
- Give about ${plan.practiceQuestions} practice questions total, increasing difficulty if they're doing well.
- Track their score mentally.`;
  },

  CHECK: (cfg) => {
    const plan = getTutorChallengePlan({
      mode: 'quiz',
      learnerContext: { grade: cfg.grade },
      difficulty: cfg.difficulty,
    });
    return `
[TUTOR PHASE: CHECK]
Final comprehension check for ${cfg.topic} (${cfg.subject}, ${cfg.grade}).
- Ask ${pluralize(plan.synthesisQuestions, 'synthesis question')} that combine concepts from the lesson.
- These should be slightly harder than practice questions.
- If they get it right: celebrate and summarize what they learned.
- If they struggle: briefly re-explain and offer to practice more.
- End with a confidence check: "How do you feel about ${cfg.topic} now? Rate 1-5."`;
  },

  COMPLETE: (cfg) => `
[TUTOR PHASE: COMPLETE]
The tutoring session on ${cfg.topic} is complete.
- Provide a brief summary of what was covered.
- Highlight their strengths and areas to review.
- Suggest next topics or related areas to explore.
- Encourage them: "You've made great progress today!"`,
};

// ─── Phase advancement order ─────────────────────────────────────────────────

const PHASE_ORDER: TutorPhase[] = ['DIAGNOSE', 'TEACH', 'PRACTICE', 'CHECK', 'COMPLETE'];

const INITIAL_CRITERIA: PhaseCriteria = {
  diagnosticQuestionsAsked: 0,
  conceptExplained: false,
  practiceAnswered: 0,
  practiceCorrect: 0,
  checkPassed: false,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTutorPipeline(): UseTutorPipelineReturn {
  const [currentPhase, setCurrentPhase] = useState<TutorPhase>('IDLE');
  const [config, setConfig] = useState<TutorPipelineConfig | null>(null);
  const [criteria, setCriteria] = useState<PhaseCriteria>(INITIAL_CRITERIA);
  const startedAtRef = useRef<string | null>(null);

  const startPipeline = useCallback((cfg: TutorPipelineConfig) => {
    setConfig(cfg);
    setCriteria(INITIAL_CRITERIA);
    setCurrentPhase('DIAGNOSE');
    startedAtRef.current = new Date().toISOString();
    logger.info('[TutorPipeline] Started', { topic: cfg.topic, grade: cfg.grade });
  }, []);

  const advancePhase = useCallback(() => {
    setCurrentPhase((prev) => {
      const idx = PHASE_ORDER.indexOf(prev);
      if (idx < 0 || idx >= PHASE_ORDER.length - 1) return prev;
      const next = PHASE_ORDER[idx + 1];
      logger.info('[TutorPipeline] Phase advanced', { from: prev, to: next });
      return next;
    });
  }, []);

  const recordDiagnosticQuestion = useCallback(() => {
    setCriteria((p) => ({ ...p, diagnosticQuestionsAsked: p.diagnosticQuestionsAsked + 1 }));
  }, []);

  const recordConceptExplained = useCallback(() => {
    setCriteria((p) => ({ ...p, conceptExplained: true }));
  }, []);

  const recordPracticeAnswer = useCallback((correct: boolean) => {
    setCriteria((p) => ({
      ...p,
      practiceAnswered: p.practiceAnswered + 1,
      practiceCorrect: p.practiceCorrect + (correct ? 1 : 0),
    }));
  }, []);

  const recordCheckResult = useCallback((passed: boolean) => {
    setCriteria((p) => ({ ...p, checkPassed: passed }));
  }, []);

  const resetPipeline = useCallback(() => {
    setCurrentPhase('IDLE');
    setConfig(null);
    setCriteria(INITIAL_CRITERIA);
    startedAtRef.current = null;
  }, []);

  // Build phase prompt override
  const phasePromptOverride =
    currentPhase !== 'IDLE' && config ? PHASE_PROMPTS[currentPhase](config) : '';

  // Build session summary
  const sessionSummary: PipelineSessionSummary | null =
    currentPhase === 'COMPLETE' && config
      ? {
          phases: PHASE_ORDER,
          config,
          criteria,
          startedAt: startedAtRef.current || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          masteryAchieved: criteria.practiceAnswered > 0
            ? (criteria.practiceCorrect / criteria.practiceAnswered) * 100 >= 80
            : false,
        }
      : null;

  return {
    currentPhase,
    config,
    criteria,
    phasePromptOverride,
    sessionSummary,
    startPipeline,
    advancePhase,
    recordDiagnosticQuestion,
    recordConceptExplained,
    recordPracticeAnswer,
    recordCheckResult,
    resetPipeline,
  };
}
